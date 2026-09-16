"""Virtual Line Model"""

import enum

from sqlalchemy import Boolean, Column, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from vigilai_api.db.base import Base


class DirectionMode(str, enum.Enum):
    both = "both"
    a_to_b = "a_to_b"
    b_to_a = "b_to_a"


class VirtualLine(Base):
    __tablename__ = "virtual_lines"

    camera_id = Column(
        UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name = Column(String(255), nullable=False)
    start_point = Column(JSONB, nullable=False)  # {x, y}
    end_point = Column(JSONB, nullable=False)  # {x, y}
    direction_mode = Column(Enum(DirectionMode, native_enum=False), nullable=False)
    color = Column(String(7), default="#00FF00", nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
