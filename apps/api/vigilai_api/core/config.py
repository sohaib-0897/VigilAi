"""VigilAI Core Configuration"""

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known-placeholder secret values that must never be used in production.
# Matched as case-insensitive prefixes against the configured value.
_SECRET_PLACEHOLDER_PREFIXES = (
    "change-this",
    "changeme",
    "development",
    "default-secret",
    "secret",
    "insecure",
    "example",
)


class Settings(BaseSettings):
    # Project Metadata
    PROJECT_NAME: str = "VigilAI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://vigilai:vigilai_dev@localhost:5432/vigilai"
    DATABASE_SYNC_URL: str = "postgresql+psycopg2://vigilai:vigilai_dev@localhost:5432/vigilai"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change-this-to-a-random-secret-key-in-production"
    ENCRYPTION_KEY: str = "change-this-to-a-32-byte-base64-key"

    # Auth
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Storage
    EVIDENCE_DIR: str = "./evidence"
    UPLOAD_DIR: str = "./uploads"
    DEMO_VIDEO_PATH: str = str(
        Path(__file__).resolve().parents[4] / "assets" / "demo" / "demo_feed.mp4"
    )
    MAX_UPLOAD_SIZE_MB: int = 500

    # Model
    YOLO_MODEL_PATH: str = "yolov8n.pt"
    YOLO_DEVICE: str = "cpu"
    YOLO_CONFIDENCE: float = 0.25
    YOLO_IOU_THRESHOLD: float = 0.45
    YOLO_IMG_SIZE: int = 640

    # Worker
    WORKER_HEARTBEAT_INTERVAL: int = 5
    MAX_CAMERAS_PER_WORKER: int = 4
    FRAME_QUEUE_SIZE: int = 30

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ENVIRONMENT: str = "development"

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    # Production domain. When set (and CORS_ORIGINS/FRONTEND_URL are left at
    # their localhost defaults) production origins are derived from it.
    DOMAIN: str | None = None

    # Comma-separated list (or "*") of proxy IPs/CIDRs Uvicorn should trust
    # for X-Forwarded-* headers. Only relevant behind a reverse proxy.
    FORWARDED_ALLOW_IPS: str = "127.0.0.1"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def COOKIE_SECURE(self) -> bool:  # noqa: N802 - matches settings naming convention
        """Whether auth cookies should carry the Secure attribute.

        True only in production (i.e. served over HTTPS). Forcing this on in
        local HTTP development would silently break cookie-based login.
        """
        return self.ENVIRONMENT == "production"

    @model_validator(mode="after")
    def derive_production_origins(self):
        """When a DOMAIN is configured and origins were left at their
        localhost defaults, derive them from the domain instead of requiring
        CORS_ORIGINS/FRONTEND_URL to be duplicated in the environment.
        """
        if self.DOMAIN:
            domain_origin = f"https://{self.DOMAIN}"
            if self.CORS_ORIGINS == ["http://localhost:3000"]:
                self.CORS_ORIGINS = [domain_origin]
            if self.FRONTEND_URL == "http://localhost:3000":
                self.FRONTEND_URL = domain_origin
        return self

    @model_validator(mode="after")
    def production_secrets(self):
        if self.ENVIRONMENT == "production":
            secret_key_lower = self.SECRET_KEY.strip().lower()
            if len(self.SECRET_KEY.strip()) < 32 or any(
                secret_key_lower.startswith(prefix) for prefix in _SECRET_PLACEHOLDER_PREFIXES
            ):
                raise ValueError(
                    "Production requires a random SECRET_KEY of at least 32 characters "
                    "(no placeholder/default value). Generate one with: "
                    'python3 -c "import secrets; print(secrets.token_urlsafe(48))"'
                )

            encryption_key_lower = self.ENCRYPTION_KEY.strip().lower()
            if any(
                encryption_key_lower.startswith(prefix) for prefix in _SECRET_PLACEHOLDER_PREFIXES
            ):
                raise ValueError(
                    "Production requires a real ENCRYPTION_KEY (no placeholder/default "
                    'value). Generate one with: python3 -c "from cryptography.fernet '
                    'import Fernet; print(Fernet.generate_key().decode())"'
                )

            from cryptography.fernet import Fernet

            try:
                Fernet(self.ENCRYPTION_KEY.encode())
            except Exception as exc:
                raise ValueError(
                    "ENCRYPTION_KEY must be a valid 32-byte urlsafe-base64-encoded Fernet "
                    'key. Generate one with: python3 -c "from cryptography.fernet import '
                    'Fernet; print(Fernet.generate_key().decode())"'
                ) from exc
        return self

    def get_sanitized_db_url(self) -> str:
        """Get database URL without password for logging."""
        try:
            from sqlalchemy.engine.url import make_url

            url = make_url(self.DATABASE_URL)
            if url.password:
                return str(url).replace(url.password, "****")
            return str(url)
        except Exception:
            return "postgresql+asyncpg://****:****@****/****"


@lru_cache
def get_settings() -> Settings:
    return Settings()
