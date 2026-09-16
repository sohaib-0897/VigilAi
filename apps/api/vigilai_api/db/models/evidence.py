"""Evidence Model"""

import enum

from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

from vigilai_api.db.base import Base


class EvidenceType(str, enum.Enum):
    snapshot = "snapshot"
    clip = "clip"


class Evidence(Base):
    __tablename__ = "evidence"

    event_id = Column(
        UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_type = Column(Enum(EvidenceType, native_enum=False), nullable=False)
    file_path = Column(String(1024), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(128), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)
