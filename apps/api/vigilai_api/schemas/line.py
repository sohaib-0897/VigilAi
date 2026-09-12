from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from vigilai_api.db.models.virtual_line import DirectionMode
from vigilai_api.schemas.zone import Point


class LineBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    start_point: Point
    end_point: Point
    direction_mode: DirectionMode
    color: str = Field(default="#00FF00", pattern="^#[0-9A-Fa-f]{6}$")
    enabled: bool = True


class LineCreate(LineBase):
    pass


class LineUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    start_point: Point | None = None
    end_point: Point | None = None
    direction_mode: DirectionMode | None = None
    color: str | None = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    enabled: bool | None = None


class LineResponse(LineBase):
    id: UUID
    camera_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
