"""
Módulo de autenticación HMAC para el worker de Telegram.

Firma los payloads enviados a /api/ingest/external-post con un secreto compartido
y timestamp para prevenir ataques de replay.
"""

import hashlib
import hmac
import time
from typing import Any

import json
from pydantic import BaseModel, Field

from config import settings

# Tolerancia de reloj para prevenir replay (segundos)
TIMESTAMP_TOLERANCE = 300  # 5 minutos


class IngestPayload(BaseModel):
    """Payload que se envía al endpoint de ingesta."""

    source_id: str
    platform: str = "TELEGRAM"
    external_id: str
    source_url: str
    raw_text: str | None = None
    image_paths: list[str] = Field(default_factory=list)
    posted_at: str  # ISO 8601
    timestamp: int  # Unix timestamp
    signature: str  # HMAC-SHA256 hex


def generate_hmac_signature(payload_bytes: bytes, secret: str, timestamp: int) -> str:
    """
    Genera firma HMAC-SHA256 del payload.

    El mensaje firmado es: {timestamp}.{payload_json}
    Esto previene replay attacks porque el timestamp debe ser reciente.
    """
    message = f"{timestamp}.".encode() + payload_bytes
    signature = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return signature


def verify_hmac_signature(payload_bytes: bytes, secret: str, timestamp: int, signature: str) -> bool:
    """
    Verifica una firma HMAC (usado en el endpoint de ingesta para validar).

    También verifica que el timestamp esté dentro de la tolerancia.
    """
    # Verificar timestamp (prevenir replay)
    now = int(time.time())
    if abs(now - timestamp) > TIMESTAMP_TOLERANCE:
        return False

    expected = generate_hmac_signature(payload_bytes, secret, timestamp)
    return hmac.compare_digest(expected, signature)


def create_ingest_payload(
    source_id: str,
    external_id: str,
    source_url: str,
    raw_text: str | None,
    image_paths: list[str],
    posted_at: str,
) -> IngestPayload:
    """
    Crea el payload firmado para el endpoint de ingesta.

    Args:
        source_id: UUID de external_sources
        external_id: message_id de Telegram (string)
        source_url: Enlace permanente al mensaje (https://t.me/canal/123)
        raw_text: Texto completo del mensaje
        image_paths: Rutas en Supabase Storage
        posted_at: Fecha del mensaje en ISO 8601

    Returns:
        IngestPayload con timestamp y signature
    """
    timestamp = int(time.time())

    # Payload sin firma para firmar
    payload_data = {
        "source_id": source_id,
        "platform": "TELEGRAM",
        "external_id": external_id,
        "source_url": source_url,
        "raw_text": raw_text,
        "image_paths": image_paths,
        "posted_at": posted_at,
    }
    # Serializar de forma determinística (claves ordenadas)
    payload_bytes = json.dumps(payload_data, sort_keys=True, separators=(",", ":")).encode()

    # Generar firma
    signature = generate_hmac_signature(payload_bytes, settings.ingest_hmac_secret, timestamp)

    return IngestPayload(
        **payload_data,
        timestamp=timestamp,
        signature=signature,
    )


def payload_to_dict(payload: IngestPayload) -> dict[str, Any]:
    """Convierte el payload a dict para envío HTTP."""
    return payload.model_dump()


__all__ = [
    "IngestPayload",
    "generate_hmac_signature",
    "verify_hmac_signature",
    "create_ingest_payload",
    "payload_to_dict",
    "TIMESTAMP_TOLERANCE",
]