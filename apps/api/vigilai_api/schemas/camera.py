from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_serializer

from vigilai_api.core.security import sanitize_uri
from vigilai_api.db.models.camera import CameraStatus, SourceType


class CameraBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    source_type: SourceType
    source_uri: str
    enabled: bool = True
    model_id: str | None = "coco-yolov8n-onnx"


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    source_type: SourceType | None = None
    source_uri: str | None = None
    enabled: bool | None = None
    analytics_enabled: bool | None = None
    model_id: str | None = None


class CameraResponse(CameraBase):
    id: UUID
    user_id: UUID
    analytics_enabled: bool
    status: CameraStatus
    status_message: str | None
    width: int | None
    height: int | None
    fps: int | None
    model_id: str | None = "coco-yolov8n-onnx"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("source_uri")
    def redact_source(self, value: str) -> str:
        return "rtsp://[configured]" if value.startswith("encrypted:") else sanitize_uri(value)


class CameraStatusResponse(BaseModel):
    id: UUID
    name: str
    status: CameraStatus
    analytics_enabled: bool
    fps: int | None


class CameraListResponse(BaseModel):
    items: list[CameraResponse]
    total: int
    page: int
    page_size: int
    pages: int
