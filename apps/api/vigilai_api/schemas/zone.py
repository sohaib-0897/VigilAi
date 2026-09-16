from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from vigilai_api.db.models.zone import ZoneType


class Point(BaseModel):
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)


class ZoneBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    zone_type: ZoneType
    points: list[Point] = Field(..., min_length=3)
    color: str = Field(default="#FF0000", pattern="^#[0-9A-Fa-f]{6}$")
    enabled: bool = True


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    zone_type: ZoneType | None = None
    points: list[Point] | None = Field(None, min_length=3)
    color: str | None = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    enabled: bool | None = None


class ZoneResponse(ZoneBase):
    id: UUID
    camera_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
