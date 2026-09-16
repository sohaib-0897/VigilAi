"""Zone Model"""

import enum

from sqlalchemy import Boolean, Column, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from vigilai_api.db.base import Base


class ZoneType(str, enum.Enum):
    restricted = "restricted"
    entrance = "entrance"
    exit = "exit"
    parking = "parking"
    pedestrian = "pedestrian"
    loading = "loading"
    custom = "custom"


class Zone(Base):
    __tablename__ = "zones"

    camera_id = Column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    zone_type = Column(Enum(ZoneType, native_enum=False), nullable=False)
    points = Column(JSONB, nullable=False)  # List of {x, y}
    color = Column(String(7), default="#FF0000", nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
