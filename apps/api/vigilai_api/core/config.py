"""VigilAI Core Configuration"""

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Project Metadata
    PROJECT_NAME: str = "VigilAI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://vigilai:vigilai_dev@localhost:5432/vigilai"
    DATABASE_SYNC_URL: str = "postgresql://vigilai:vigilai_dev@localhost:5432/vigilai"

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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def production_secrets(self):
        if self.ENVIRONMENT == "production":
            if len(self.SECRET_KEY) < 32 or self.SECRET_KEY.startswith("change-this"):
                raise ValueError(
                    "Production requires a random SECRET_KEY of at least 32 characters"
                )
            from cryptography.fernet import Fernet

            Fernet(self.ENCRYPTION_KEY.encode())
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
