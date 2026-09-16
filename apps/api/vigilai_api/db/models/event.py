"""Event Model"""

import enum

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from vigilai_api.db.base import Base
from vigilai_api.db.models.analytics_rule import Severity


class EventStatus(str, enum.Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"
    dismissed = "dismissed"


class Event(Base):
    __tablename__ = "events"

    camera_id = Column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_id = Column(
        UUID(as_uuid=True), ForeignKey("analytics_rules.id", ondelete="SET NULL"), nullable=True
    )
    event_type = Column(String(255), nullable=False, index=True)
    severity = Column(Enum(Severity, native_enum=False), nullable=False, index=True)
    object_class = Column(String(255), nullable=True)
    track_id = Column(Integer, nullable=True)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)
    line_id = Column(
        UUID(as_uuid=True), ForeignKey("virtual_lines.id", ondelete="SET NULL"), nullable=True
    )
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
    status = Column(
        Enum(EventStatus, native_enum=False), default=EventStatus.active, nullable=False, index=True
    )
    fingerprint = Column(String(255), nullable=False, index=True)

    evidences = relationship(
        "Evidence", backref="event", cascade="all, delete-orphan", lazy="selectin"
    )
