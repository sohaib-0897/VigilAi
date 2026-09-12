from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    redis_url: str = Field(default="redis://localhost:6379/0", validation_alias="REDIS_URL")
    database_sync_url: str = Field(
        default="postgresql://vigilai:vigilai_dev@localhost:5432/vigilai",
        validation_alias="DATABASE_SYNC_URL",
    )
    worker_id: str = Field(default="worker-1", validation_alias="WORKER_ID")
    max_cameras_per_worker: int = Field(default=4, validation_alias="MAX_CAMERAS_PER_WORKER")
    heartbeat_interval: int = Field(default=5, validation_alias="WORKER_HEARTBEAT_INTERVAL")
    frame_queue_size: int = Field(default=30, validation_alias="FRAME_QUEUE_SIZE")
    evidence_dir: str = Field(default="./evidence", validation_alias="EVIDENCE_DIR")
    model_path: str = Field(default="yolov8n.pt", validation_alias="YOLO_MODEL_PATH")
    model_device: str = Field(default="cpu", validation_alias="YOLO_DEVICE")
    model_confidence: float = Field(default=0.4, validation_alias="YOLO_CONFIDENCE")
    model_iou: float = Field(default=0.5, validation_alias="YOLO_IOU_THRESHOLD")
    img_size: int = Field(default=640, validation_alias="YOLO_IMG_SIZE")
    enabled_classes: list[int] = Field(
        default=[0, 1, 2, 3, 5, 7], validation_alias="ENABLED_CLASSES"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = WorkerSettings()
