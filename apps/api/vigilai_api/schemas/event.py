from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from vigilai_api.db.models.analytics_rule import Severity
from vigilai_api.db.models.event import EventStatus


class EvidenceBase(BaseModel):
    id: UUID
    evidence_type: str
    file_path: str
    file_size: int | None
    mime_type: str
    width: int | None
    height: int | None

    model_config = {"from_attributes": True}


class EventBase(BaseModel):
    camera_id: UUID
    rule_id: UUID | None = None
    event_type: str
    severity: Severity
    object_class: str | None = None
    track_id: int | None = None
    zone_id: UUID | None = None
    line_id: UUID | None = None
    started_at: datetime
    ended_at: datetime | None = None
    metadata: dict[str, Any] | None = Field(None, validation_alias="metadata_")
    status: EventStatus
    fingerprint: str


class EventResponse(EventBase):
    id: UUID
    created_at: datetime
    evidences: list[EvidenceBase] = []

    model_config = {"from_attributes": True, "populate_by_name": True}


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int
    page: int
    page_size: int
    pages: int


class EventFilter(BaseModel):
    camera_id: UUID | None = None
    event_type: str | None = None
    severity: Severity | None = None
    status: EventStatus | None = None
    object_class: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
