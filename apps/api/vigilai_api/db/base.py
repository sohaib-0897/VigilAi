"""VigilAI SQLAlchemy Base"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, MetaData
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)


class BaseEntity:
    """Base class for all models."""

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=None)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


Base = declarative_base(cls=BaseEntity, metadata=metadata)
