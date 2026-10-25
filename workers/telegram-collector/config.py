"""
Configuración del Worker de Telegram para Patitas.

Lee variables de entorno y valida la configuración.
NUNCA hardcodees secrets; usa variables de entorno / GitHub Actions secrets.
"""

from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración validada con Pydantic."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # En GitHub Actions los secrets opcionales que no están definidos llegan
        # como cadena vacía. Sin esto, pydantic intentaba convertir "" a int y
        # el worker moría al importar `config` (antes de conectar a Telegram),
        # así que el workflow fallaba en cada ejecución. Con `env_ignore_empty`
        # una variable vacía se ignora y se usa el valor por defecto.
        env_ignore_empty=True,
    )

    # =========================================================================
    # Telegram API (obtener en https://my.telegram.org)
    # =========================================================================
    telegram_api_id: int = Field(..., description="API ID de Telegram (entero)")
    telegram_api_hash: str = Field(..., description="API Hash de Telegram (string)")
    telegram_string_session: str = Field(
        ..., description="StringSession generada localmente (ver docs/TELEGRAM_SESSION.md)"
    )

    # =========================================================================
    # Supabase (para subir imágenes y actualizar last_cursor)
    # =========================================================================
    supabase_url: str = Field(..., description="URL del proyecto Supabase (ej: https://xxx.supabase.co)")
    supabase_service_role_key: str = Field(..., description="Service Role Key (bypassa RLS)")

    # Bucket de Storage para imágenes importadas
    supabase_storage_bucket: str = Field(
        default="external-imports",
        description="Bucket de Supabase Storage para imágenes de fuentes externas",
    )

    # =========================================================================
    # API de ingesta (endpoint /api/ingest/external-post)
    # =========================================================================
    ingest_api_url: str = Field(
        ..., description="URL completa del endpoint de ingesta (ej: https://patitas.app/api/ingest/external-post)"
    )
    ingest_hmac_secret: str = Field(
        ..., description="Secreto compartido HMAC (igual que INGEST_HMAC_SECRET en Vercel)"
    )

    # =========================================================================
    # Comportamiento del worker
    # =========================================================================
    # Límite de tamaño por imagen (bytes) - 8MB por defecto
    max_image_size_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=50 * 1024 * 1024)

    # Tipos MIME permitidos
    allowed_mime_types: list[str] = Field(
        default=["image/jpeg", "image/png", "image/webp", "image/gif"],
        description="Tipos MIME permitidos para descarga",
    )

    # Máximo de imágenes por mensaje/álbum
    max_images_per_message: int = Field(default=10, ge=1, le=20)

    # Solo se importan posts publicados dentro de esta ventana (días).
    # Evita llenar la plataforma con avisos viejos al añadir una fuente nueva.
    max_post_age_days: int = Field(default=30, ge=1, le=365)

    # Descarta mensajes sin foto: toda publicación importada debe tener imagen.
    require_image: bool = Field(default=True)

    # Mensajes recientes a revisar la primera vez que se procesa una fuente.
    initial_fetch_limit: int = Field(default=30, ge=1, le=100)

    # Tiempo de espera entre requests a Telegram (segundos)
    telegram_request_delay: float = Field(default=0.5, ge=0.1, le=5.0)

    # Reintentos para operaciones de red
    max_retries: int = Field(default=3, ge=1, le=10)
    retry_base_delay: float = Field(default=2.0, ge=0.5, le=30.0)

    # Tiempo de espera para descarga de imágenes (segundos)
    image_download_timeout: float = Field(default=30.0, ge=5.0, le=120.0)

    # Tiempo de espera para llamada a API de ingesta (segundos)
    ingest_api_timeout: float = Field(default=30.0, ge=5.0, le=120.0)

    # Umbral de errores consecutivos para desactivar fuente
    max_consecutive_errors: int = Field(default=5, ge=1, le=20)

    # Log level
    log_level: str = Field(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    # =========================================================================
    # Validaciones personalizadas
    # =========================================================================
    @field_validator("supabase_url", "ingest_api_url")
    @classmethod
    def validate_https_url(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Debe ser una URL HTTPS")
        return v.rstrip("/")

    @field_validator("allowed_mime_types", mode="before")
    @classmethod
    def parse_mime_types(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v


# Instancia global de configuración
settings = Settings()

__all__ = ["settings"]