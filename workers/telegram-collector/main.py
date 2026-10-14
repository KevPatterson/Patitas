#!/usr/bin/env python3
"""
Worker de Telegram para Patitas - Colector de canales/grupos públicos.

Lee mensajes nuevos de fuentes configuradas en external_sources,
descarga imágenes a Supabase Storage, y envía a /api/ingest/external-post
autenticado con HMAC.

Ejecución: python -m main
Programado: GitHub Actions cron cada 15-30 minutos.
"""

import asyncio
import json
import sys
import traceback
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

import httpx
import structlog
from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl.types import Message, MessageMediaPhoto, MessageMediaDocument, Channel, Chat

from .config import settings
from .storage import storage_client, download_telegram_media, StorageValidationError
from .auth import create_ingest_payload, payload_to_dict

# Configurar logging estructurado
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)


class SourceProcessor:
    """Procesa una fuente individual (canal/grupo de Telegram)."""

    def __init__(self, telethon_client: TelegramClient, http_client: httpx.AsyncClient) -> None:
        self.telethon = telethon_client
        self.http = http_client
        self.stats = {
            "processed": 0,
            "skipped": 0,
            "errors": 0,
            "images_downloaded": 0,
            "albums_processed": 0,
        }

    async def process_source(self, source: dict[str, Any]) -> dict[str, Any]:
        """
        Procesa una fuente completa.

        Args:
            source: Dict con id, handle_or_url, last_cursor, is_trusted, etc.

        Returns:
            Dict con estadísticas y nuevo cursor
        """
        source_id = source["id"]
        handle = source["handle_or_url"]
        last_cursor = source.get("last_cursor")
        is_trusted = source.get("is_trusted", False)

        logger.info("source_processing_start", source_id=source_id, handle=handle, last_cursor=last_cursor)

        try:
            # Resolver entidad (canal/grupo)
            entity = await self.telethon.get_entity(handle)
            logger.debug("source_entity_resolved", source_id=source_id, entity_type=type(entity).__name__)

            # Obtener mensajes nuevos (incremental desde last_cursor)
            messages = await self._fetch_new_messages(entity, last_cursor)
            logger.info("source_messages_fetched", source_id=source_id, count=len(messages))

            # Agrupar por grouped_id (álbumes)
            grouped_messages = self._group_by_album(messages)
            logger.debug("source_messages_grouped", source_id=source_id, groups=len(grouped_messages))

            # Procesar cada grupo/mensaje
            new_cursor = last_cursor
            for group_id, group_messages in grouped_messages.items():
                # Usar el message_id más alto del grupo como cursor
                group_max_id = max(m.id for m in group_messages)
                if last_cursor is None or group_max_id > int(last_cursor):
                    new_cursor = str(group_max_id)

                await self._process_message_group(source, entity, group_messages, is_trusted)
                self.stats["processed"] += 1

                # Rate limiting amable
                await asyncio.sleep(settings.telegram_request_delay)

            logger.info(
                "source_processing_complete",
                source_id=source_id,
                processed=self.stats["processed"],
                new_cursor=new_cursor,
            )

            return {
                "source_id": source_id,
                "success": True,
                "new_cursor": new_cursor,
                "stats": self.stats.copy(),
            }

        except errors.FloodWaitError as e:
            # FloodWait: Telegram nos pide esperar
            wait_seconds = e.seconds
            logger.warning("source_flood_wait", source_id=source_id, wait_seconds=wait_seconds)
            # No actualizar cursor; reintentar en próxima ejecución
            return {
                "source_id": source_id,
                "success": False,
                "error": f"FLOOD_WAIT_{wait_seconds}s",
                "retry_after": wait_seconds,
                "new_cursor": last_cursor,
            }

        except errors.ChannelPrivateError:
            logger.error("source_private_channel", source_id=source_id, handle=handle)
            return {
                "source_id": source_id,
                "success": False,
                "error": "CHANNEL_PRIVATE",
                "new_cursor": last_cursor,
            }

        except Exception as e:
            logger.exception("source_processing_error", source_id=source_id, error=str(e))
            self.stats["errors"] += 1
            return {
                "source_id": source_id,
                "success": False,
                "error": type(e).__name__,
                "details": str(e)[:500],
                "new_cursor": last_cursor,
            }

    async def _fetch_new_messages(self, entity: Channel | Chat, last_cursor: str | None) -> list[Message]:
        """
        Obtiene mensajes nuevos desde last_cursor.

        Usa iter_messages con min_id para lectura incremental eficiente.
        """
        messages = []
        min_id = int(last_cursor) if last_cursor else 0

        # Límite razonable por ejecución para evitar timeouts
        async for message in self.telethon.iter_messages(entity, min_id=min_id, limit=100, reverse=True):
            # Solo mensajes con contenido (texto o media)
            if message.text or message.media:
                messages.append(message)

        return messages

    def _group_by_album(self, messages: list[Message]) -> dict[str | None, list[Message]]:
        """
        Agrupa mensajes por grouped_id (álbumes de Telegram).

        Messages sin grouped_id van en grupo None (se procesan individualmente).
        """
        groups: dict[str | None, list[Message]] = {}
        for msg in messages:
            key = str(msg.grouped_id) if msg.grouped_id else None
            if key not in groups:
                groups[key] = []
            groups[key].append(msg)
        return groups

    async def _process_message_group(
        self,
        source: dict[str, Any],
        entity: Channel | Chat,
        messages: list[Message],
        is_trusted: bool,
    ) -> None:
        """Procesa un grupo de mensajes (álbum o mensaje individual)."""
        if len(messages) > 1:
            self.stats["albums_processed"] += 1
            logger.debug("processing_album", count=len(messages), grouped_id=messages[0].grouped_id)

        # El mensaje principal es el primero (más antiguo en reverse=True)
        main_msg = messages[0]

        # Construir source_url permanente
        source_url = self._build_source_url(entity, main_msg.id)

        # Combinar texto de todos los mensajes del grupo
        raw_text_parts = [m.text for m in messages if m.text]
        raw_text = "\n---\n".join(raw_text_parts) if raw_text_parts else None

        # Descargar imágenes
        image_paths = await self._download_group_images(source["id"], str(main_msg.id), messages)

        # Fecha del mensaje principal
        posted_at = main_msg.date.replace(tzinfo=timezone.utc).isoformat()

        # Crear payload firmado
        payload = create_ingest_payload(
            source_id=source["id"],
            external_id=str(main_msg.id),
            source_url=source_url,
            raw_text=raw_text,
            image_paths=image_paths,
            posted_at=posted_at,
        )

        # Enviar a API de ingesta
        await self._send_to_ingest_api(payload)

    async def _download_group_images(
        self, source_id: str, external_id: str, messages: list[Message]
    ) -> list[str]:
        """Descarga todas las imágenes de un grupo de mensajes."""
        image_tasks = []

        for msg in messages:
            if not msg.media:
                continue

            # Solo fotos (no documentos, videos, etc.)
            if isinstance(msg.media, MessageMediaPhoto):
                image_tasks.append(self._download_photo(msg))
            elif isinstance(msg.media, MessageMediaDocument):
                # Verificar si es imagen por MIME
                doc = msg.media.document
                if doc.mime_type and doc.mime_type.startswith("image/"):
                    image_tasks.append(self._download_document(msg))

        # Limitar cantidad
        if len(image_tasks) > settings.max_images_per_message:
            logger.warning(
                "too_many_images_truncating",
                source_id=source_id,
                external_id=external_id,
                count=len(image_tasks),
                limit=settings.max_images_per_message,
            )
            image_tasks = image_tasks[: settings.max_images_per_message]

        # Descargar en paralelo (con semáforo para no saturar)
        semaphore = asyncio.Semaphore(3)

        async def bounded_download(task):
            async with semaphore:
                return await task

        results = await asyncio.gather(*[bounded_download(t) for t in image_tasks], return_exceptions=True)

        # Procesar resultados
        valid_images = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                if isinstance(result, StorageValidationError):
                    logger.warning("image_validation_failed", error=str(result), index=idx)
                else:
                    logger.exception("image_download_error", index=idx)
                continue
            valid_images.append(result)
            self.stats["images_downloaded"] += 1

        # Subir a Storage
        if valid_images:
            try:
                paths = await storage_client.upload_multiple(source_id, external_id, valid_images)
                return paths
            except Exception:
                logger.exception("storage_upload_failed_for_group", source_id=source_id, external_id=external_id)
                return []

        return []

    async def _download_photo(self, msg: Message) -> tuple[bytes, str, str | None]:
        """Descarga una foto de Telegram."""
        # Telethon proporciona URL de descarga directa para fotos
        file_bytes = await self.telethon.download_media(msg.media, file=bytes)
        # Telethon no da filename fácil para fotos; generar uno
        filename = f"photo_{msg.id}.jpg"
        return file_bytes, filename, "image/jpeg"

    async def _download_document(self, msg: Message) -> tuple[bytes, str, str | None]:
        """Descarga un documento (imagen) de Telegram."""
        doc = msg.media.document
        # Obtener URL de descarga del CDN de Telegram
        # Usar download_media con bytes
        file_bytes = await self.telethon.download_media(msg.media, file=bytes)

        # Filename desde atributos
        filename = f"doc_{msg.id}"
        for attr in doc.attributes:
            if hasattr(attr, "file_name") and attr.file_name:
                filename = attr.file_name
                break

        return file_bytes, filename, doc.mime_type

    def _build_source_url(self, entity: Channel | Chat, message_id: int) -> str:
        """Construye URL permanente al mensaje en Telegram."""
        # Para canales públicos: https://t.me/username/message_id
        # Para grupos: https://t.me/c/{channel_id}/{message_id} (no público)
        # Solo procesamos públicos, así que usamos username
        if hasattr(entity, "username") and entity.username:
            return f"https://t.me/{entity.username}/{message_id}"
        # Fallback para canales sin username (no deberían estar en fuentes)
        return f"https://t.me/c/{entity.id}/{message_id}"

    async def _send_to_ingest_api(self, payload: Any) -> None:
        """Envía el payload firmado al endpoint de ingesta."""
        payload_dict = payload_to_dict(payload)
        payload_bytes = json.dumps(payload_dict, sort_keys=True, separators=(",", ":")).encode()

        # Reintentos con backoff
        for attempt in range(settings.max_retries):
            try:
                response = await self.http.post(
                    settings.ingest_api_url,
                    json=payload_dict,
                    timeout=settings.ingest_api_timeout,
                    headers={"Content-Type": "application/json"},
                )

                if response.status_code == 200:
                    result = response.json()
                    logger.info(
                        "ingest_success",
                        external_post_id=result.get("external_post_id"),
                        status=result.get("status"),
                        confidence=result.get("confidence"),
                    )
                    return

                elif response.status_code == 409:
                    # Conflicto - ya existe (idempotencia)
                    logger.info("ingest_duplicate", external_id=payload.external_id)
                    return

                elif response.status_code == 401:
                    # HMAC inválido - error de configuración
                    logger.error("ingest_hmac_invalid", status=response.status_code, body=response.text)
                    raise RuntimeError("HMAC inválido - verificar INGEST_HMAC_SECRET")

                else:
                    logger.warning(
                        "ingest_api_error",
                        status=response.status_code,
                        body=response.text[:500],
                        attempt=attempt + 1,
                    )

            except httpx.TimeoutException:
                logger.warning("ingest_timeout", attempt=attempt + 1)
            except httpx.RequestError as e:
                logger.warning("ingest_network_error", error=str(e), attempt=attempt + 1)

            # Backoff antes de reintentar
            if attempt < settings.max_retries - 1:
                delay = settings.retry_base_delay * (2**attempt)
                await asyncio.sleep(delay)

        # Todos los reintentos fallaron
        raise RuntimeError(f"Falló envío a API de ingesta tras {settings.max_retries} intentos")


class SupabaseTracker:
    """Actualiza last_cursor, last_run_at, error_count en external_sources."""

    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self.http = http_client
        self.base_url = settings.supabase_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    async def update_source_result(self, result: dict[str, Any]) -> None:
        """Actualiza la fuente según el resultado del procesamiento."""
        source_id = result["source_id"]
        success = result["success"]

        if success:
            # Éxito: actualizar cursor, last_run_at, resetear error_count
            new_cursor = result.get("new_cursor")
            update_data = {
                "last_run_at": datetime.now(timezone.utc).isoformat(),
                "error_count": 0,
            }
            if new_cursor:
                update_data["last_cursor"] = new_cursor
        else:
            # Error: incrementar error_count, actualizar last_run_at
            # Si error_count >= max_consecutive_errors, desactivar fuente
            # Primero leer error_count actual
            current = await self._get_source(source_id)
            current_errors = current.get("error_count", 0) if current else 0
            new_errors = current_errors + 1

            update_data = {
                "last_run_at": datetime.now(timezone.utc).isoformat(),
                "error_count": new_errors,
            }

            if new_errors >= settings.max_consecutive_errors:
                update_data["is_active"] = False
                logger.warning("source_deactivated_max_errors", source_id=source_id, errors=new_errors)

        await self._update_source(source_id, update_data)

    async def _get_source(self, source_id: str) -> dict | None:
        """Obtiene una fuente por ID."""
        url = f"{self.base_url}/rest/v1/external_sources?id=eq.{source_id}&select=error_count"
        try:
            resp = await self.http.get(url, headers=self.headers, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            return data[0] if data else None
        except Exception:
            logger.exception("tracker_get_source_failed", source_id=source_id)
            return None

    async def _update_source(self, source_id: str, data: dict) -> None:
        """Actualiza una fuente."""
        url = f"{self.base_url}/rest/v1/external_sources?id=eq.{source_id}"
        try:
            resp = await self.http.patch(url, headers=self.headers, json=data, timeout=10.0)
            resp.raise_for_status()
            logger.debug("tracker_update_success", source_id=source_id, data=data)
        except Exception:
            logger.exception("tracker_update_failed", source_id=source_id, data=data)


async def fetch_active_sources(http_client: httpx.AsyncClient) -> list[dict[str, Any]]:
    """Obtiene todas las fuentes activas de Telegram desde Supabase."""
    base_url = settings.supabase_url.rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }

    # Solo fuentes TELEGRAM activas
    url = f"{base_url}/rest/v1/external_sources?platform=eq.TELEGRAM&is_active=eq.true&select=id,platform,handle_or_url,name,province,is_active,is_trusted,last_cursor,last_run_at,error_count"

    try:
        resp = await http_client.get(url, headers=headers, timeout=10.0)
        resp.raise_for_status()
        sources = resp.json()
        logger.info("fetched_active_sources", count=len(sources))
        return sources
    except Exception:
        logger.exception("fetch_sources_failed")
        return []


async def main() -> int:
    """Punto de entrada principal del worker."""
    logger.info("worker_starting", version="1.0.0")

    # Validar configuración crítica
    required = [
        settings.telegram_api_id,
        settings.telegram_api_hash,
        settings.telegram_string_session,
        settings.supabase_url,
        settings.supabase_service_role_key,
        settings.ingest_api_url,
        settings.ingest_hmac_secret,
    ]
    if not all(required):
        logger.error("missing_required_config")
        return 1

    # Cliente HTTP compartido
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_connections=20),
    )

    # Cliente Telethon con StringSession
    telethon_client = TelegramClient(
        StringSession(settings.telegram_string_session),
        settings.telegram_api_id,
        settings.telegram_api_hash,
        device_model="Patitas Worker",
        system_version="Linux",
        app_version="1.0.0",
    )

    tracker = SupabaseTracker(http_client)

    try:
        # Conectar a Telegram
        await telethon_client.connect()
        if not await telethon_client.is_user_authorized():
            logger.error("telethon_not_authorized - StringSession inválida o expirada")
            return 1

        me = await telethon_client.get_me()
        logger.info("telethon_connected", user_id=me.id, username=me.username)

        # Obtener fuentes activas
        sources = await fetch_active_sources(http_client)
        if not sources:
            logger.info("no_active_sources")
            return 0

        # Procesar cada fuente
        processor = SourceProcessor(telethon_client, http_client)
        overall_success = True

        for source in sources:
            result = await processor.process_source(source)
            await tracker.update_source_result(result)

            if not result["success"]:
                overall_success = False
                # Continuar con otras fuentes

        logger.info(
            "worker_complete",
            total_sources=len(sources),
            total_processed=processor.stats["processed"],
            total_albums=processor.stats["albums_processed"],
            total_images=processor.stats["images_downloaded"],
            total_errors=processor.stats["errors"],
            overall_success=overall_success,
        )

        return 0 if overall_success else 1

    except Exception:
        logger.exception("worker_fatal_error")
        return 1

    finally:
        await telethon_client.disconnect()
        await http_client.aclose()
        await storage_client.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)