"""Camera Session Model"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from vigilai_api.db.base import Base


class CameraSession(Base):
    __tablename__ = "camera_sessions"

    camera_id = Column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    frames_received = Column(Integer, default=0, nullable=False)
    frames_processed = Column(Integer, default=0, nullable=False)
    frames_dropped = Column(Integer, default=0, nullable=False)
    total_detections = Column(Integer, default=0, nullable=False)
    total_events = Column(Integer, default=0, nullable=False)
    status = Column(String(50), nullable=False)
    error_message = Column(String, nullable=True)
