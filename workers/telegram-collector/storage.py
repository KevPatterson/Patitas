"""
Módulo de Storage para subir imágenes a Supabase Storage.

Maneja autenticación con Service Role Key, validación de MIME/tamaño,
y reintentos con backoff exponencial.
"""

import hashlib
import mimetypes
import os
from pathlib import Path
from urllib.parse import urljoin

import httpx
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from config import settings

logger = structlog.get_logger(__name__)


class StorageError(Exception):
    """Error base para operaciones de Storage."""

    pass


class StorageUploadError(StorageError):
    """Error al subir archivo a Storage."""

    pass


class StorageValidationError(StorageError):
    """Error de validación de archivo."""

    pass


class SupabaseStorageClient:
    """
    Cliente para Supabase Storage API.

    Usa Service Role Key para bypassear RLS (solo worker de ingesta).
    """

    def __init__(self) -> None:
        self.base_url = urljoin(settings.supabase_url, "/storage/v1/")
        self.headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
        }
        self.bucket = settings.supabase_storage_bucket
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Obtiene o crea el cliente HTTP asíncrono."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(settings.image_download_timeout),
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            )
        return self._client

    async def close(self) -> None:
        """Cierra el cliente HTTP."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def _validate_file(self, content: bytes, filename: str, mime_type: str | None = None) -> str:
        """
        Valida el archivo antes de subirlo.

        Returns:
            MIME type detectado/validado.

        Raises:
            StorageValidationError: Si el archivo no pasa validaciones.
        """
        # Validar tamaño
        if len(content) > settings.max_image_size_bytes:
            max_mb = settings.max_image_size_bytes / (1024 * 1024)
            raise StorageValidationError(
                f"Archivo demasiado grande: {len(content)} bytes (máx {max_mb:.0f}MB)"
            )

        # Detectar MIME type
        detected_mime = mime_type
        if not detected_mime:
            detected_mime = mimetypes.guess_type(filename)[0]
        if not detected_mime:
            # Intentar detectar por magic bytes
            detected_mime = self._detect_mime_from_bytes(content)

        if detected_mime not in settings.allowed_mime_types:
            raise StorageValidationError(
                f"Tipo MIME no permitido: {detected_mime}. Permitidos: {settings.allowed_mime_types}"
            )

        return detected_mime

    def _detect_mime_from_bytes(self, content: bytes) -> str:
        """Detecta MIME type por magic bytes."""
        if content.startswith(b"\xff\xd8\xff"):
            return "image/jpeg"
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return "image/png"
        if content.startswith(b"RIFF") and b"WEBP" in content[:12]:
            return "image/webp"
        if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
            return "image/gif"
        return "application/octet-stream"

    def _generate_storage_path(self, source_id: str, external_id: str, filename: str, index: int = 0) -> str:
        """
        Genera ruta de almacenamiento consistente.

        Formato: {platform}/{source_id}/{external_id}/{index}_{hash}.{ext}
        """
        # Hash corto del contenido para deduplicación básica
        content_hash = hashlib.md5(filename.encode()).hexdigest()[:8]
        ext = Path(filename).suffix.lower() or ".jpg"
        if index > 0:
            return f"telegram/{source_id}/{external_id}/{index}_{content_hash}{ext}"
        return f"telegram/{source_id}/{external_id}/{content_hash}{ext}"

    @retry(
        wait=wait_exponential_jitter(initial=1, max=10),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type((httpx.RequestError, httpx.HTTPStatusError, StorageUploadError)),
        reraise=True,
    )
    async def upload_image(
        self,
        source_id: str,
        external_id: str,
        content: bytes,
        filename: str,
        mime_type: str | None = None,
        index: int = 0,
    ) -> str:
        """
        Sube una imagen a Supabase Storage.

        Args:
            source_id: ID de la fuente externa (external_sources.id)
            external_id: ID externo del mensaje (message_id)
            content: Bytes de la imagen
            filename: Nombre original del archivo
            mime_type: MIME type opcional (se detecta si no se provee)
            index: Índice para álbumes (0 = primera imagen)

        Returns:
            Ruta pública del archivo en Storage (para usar en image_paths)

        Raises:
            StorageValidationError: Si el archivo no es válido
            StorageUploadError: Si falla la subida tras reintentos
        """
        # Validar
        validated_mime = self._validate_file(content, filename, mime_type)

        # Generar ruta
        storage_path = self._generate_storage_path(source_id, external_id, filename, index)

        # Subir
        client = await self._get_client()
        upload_url = urljoin(self.base_url, f"object/{self.bucket}/{storage_path}")

        upload_headers = {
            **self.headers,
            "Content-Type": validated_mime,
            "x-upsert": "true",  # Sobrescribir si existe (idempotencia)
        }

        try:
            response = await client.post(upload_url, content=content, headers=upload_headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 409:
                # Conflicto - ya existe, OK por idempotencia
                logger.debug("storage_conflict_upsert", path=storage_path)
            else:
                logger.error("storage_upload_failed", path=storage_path, status=e.response.status_code, error=str(e))
                raise StorageUploadError(f"Error subiendo a Storage: {e.response.status_code}") from e
        except httpx.RequestError as e:
            logger.error("storage_upload_network_error", path=storage_path, error=str(e))
            raise StorageUploadError(f"Error de red subiendo a Storage: {e}") from e

        # Retornar ruta relativa (el endpoint de ingesta la usará para construir URL pública)
        logger.info("storage_upload_success", path=storage_path, size=len(content), mime=validated_mime)
        return storage_path

    async def upload_multiple(
        self,
        source_id: str,
        external_id: str,
        images: list[tuple[bytes, str, str | None]],  # (content, filename, mime_type)
    ) -> list[str]:
        """
        Sube múltiples imágenes (álbum).

        Args:
            source_id: ID de la fuente
            external_id: ID del mensaje (grouped_id para álbumes)
            images: Lista de tuplas (content, filename, mime_type)

        Returns:
            Lista de rutas de Storage en orden
        """
        paths = []
        for idx, (content, filename, mime_type) in enumerate(images):
            try:
                path = await self.upload_image(source_id, external_id, content, filename, mime_type, idx)
                paths.append(path)
            except StorageError:
                logger.exception("storage_upload_failed_in_album", index=idx, external_id=external_id)
                raise
        return paths

    def get_public_url(self, storage_path: str) -> str:
        """
        Construye la URL pública de un archivo en Storage.

        Nota: El bucket debe ser público o tener política que permita lectura pública.
        """
        return urljoin(self.base_url, f"object/public/{self.bucket}/{storage_path}")


# Instancia singleton
storage_client = SupabaseStorageClient()


async def download_telegram_media(
    client: httpx.AsyncClient,
    media_url: str,
    max_size: int = settings.max_image_size_bytes,
) -> tuple[bytes, str, str | None]:
    """
    Descarga media de Telegram (CDN) con validación de tamaño en streaming.

    Args:
        client: Cliente HTTP compartido
        media_url: URL del archivo en Telegram CDN
        max_size: Tamaño máximo permitido en bytes

    Returns:
        Tupla (content_bytes, filename, mime_type)

    Raises:
        StorageValidationError: Si excede tamaño o tipo no permitido
        httpx.RequestError: Error de red
    """
    # HEAD request para verificar Content-Length y Content-Type antes de descargar
    head_resp = await client.head(media_url, timeout=10.0)
    head_resp.raise_for_status()

    content_length = head_resp.headers.get("content-length")
    if content_length and int(content_length) > max_size:
        raise StorageValidationError(f"Archivo demasiado grande ({content_length} bytes) según HEAD")

    content_type = head_resp.headers.get("content-type")
    if content_type and content_type not in settings.allowed_mime_types:
        raise StorageValidationError(f"Tipo MIME no permitido en HEAD: {content_type}")

    # Descargar con streaming y límite de tamaño
    content = bytearray()
    async with client.stream("GET", media_url, timeout=settings.image_download_timeout) as resp:
        resp.raise_for_status()
        async for chunk in resp.aiter_bytes(chunk_size=8192):
            content.extend(chunk)
            if len(content) > max_size:
                raise StorageValidationError(f"Archivo excede tamaño máximo durante descarga ({len(content)} bytes)")

    # Extraer filename de URL o headers
    filename = "image.jpg"
    content_disposition = resp.headers.get("content-disposition")
    if content_disposition and "filename=" in content_disposition:
        import re

        match = re.search(r'filename[*]?=([^;]+)', content_disposition)
        if match:
            filename = match.group(1).strip('"')
    else:
        # De URL
        url_path = media_url.split("?")[0]
        url_filename = os.path.basename(url_path)
        if url_filename and "." in url_filename:
            filename = url_filename

    # Asegurar extensión correcta
    if not Path(filename).suffix:
        ext = mimetypes.guess_extension(content_type or "image/jpeg") or ".jpg"
        filename += ext

    return bytes(content), filename, content_type


__all__ = [
    "SupabaseStorageClient",
    "StorageError",
    "StorageUploadError",
    "StorageValidationError",
    "storage_client",
    "download_telegram_media",
]