"""Analytics Rule Model"""

import enum

from sqlalchemy import Boolean, Column, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from vigilai_api.db.base import Base


class RuleType(str, enum.Enum):
    zone_entry = "zone_entry"
    zone_exit = "zone_exit"
    dwell_time = "dwell_time"
    line_crossing = "line_crossing"
    occupancy_threshold = "occupancy_threshold"
    class_presence = "class_presence"


class Severity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AnalyticsRule(Base):
    __tablename__ = "analytics_rules"

    camera_id = Column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    rule_type = Column(Enum(RuleType, native_enum=False), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    severity = Column(Enum(Severity, native_enum=False), nullable=False)
    object_classes = Column(JSONB, nullable=True)  # List of class names
    zone_id = Column(
        UUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    line_id = Column(
        UUID(as_uuid=True),
        ForeignKey("virtual_lines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    threshold_value = Column(Float, nullable=True)
    cooldown_seconds = Column(Integer, default=30, nullable=False)
    configuration = Column(JSONB, nullable=True)
