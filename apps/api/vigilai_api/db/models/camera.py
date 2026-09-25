"""Camera Model"""

import enum

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from vigilai_api.db.base import Base


class SourceType(str, enum.Enum):
    local_video = "local_video"
    webcam = "webcam"
    rtsp = "rtsp"


class CameraStatus(str, enum.Enum):
    offline = "offline"
    connecting = "connecting"
    online = "online"
    degraded = "degraded"
    error = "error"
    stopped = "stopped"


class Camera(Base):
    __tablename__ = "cameras"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    source_type = Column(Enum(SourceType, native_enum=False), nullable=False)
    source_uri = Column(String, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    analytics_enabled = Column(Boolean, default=False, nullable=False)
    status = Column(
        Enum(CameraStatus, native_enum=False),
        default=CameraStatus.offline,
        nullable=False,
        index=True,
    )
    status_message = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    fps = Column(Integer, nullable=True)
    model_id = Column(String(100), default="coco-yolov8n-onnx", nullable=True)
