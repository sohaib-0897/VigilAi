"""Track Summary Model"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from vigilai_api.db.base import Base


class TrackSummary(Base):
    __tablename__ = "track_summaries"

    camera_id = Column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id = Column(
        UUID(as_uuid=True), ForeignKey("camera_sessions.id", ondelete="SET NULL"), nullable=True
    )
    track_id = Column(Integer, nullable=False)
    object_class = Column(String(255), nullable=False)
    first_seen = Column(DateTime(timezone=True), nullable=False)
    last_seen = Column(DateTime(timezone=True), nullable=False)
    total_frames = Column(Integer, nullable=False)
    zones_visited = Column(JSONB, nullable=False, default=list)  # List of zone IDs
    lines_crossed = Column(JSONB, nullable=False, default=list)  # List of line IDs
    metadata_ = Column("metadata", JSONB, nullable=True)
