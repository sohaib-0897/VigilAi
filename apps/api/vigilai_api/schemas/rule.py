from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from vigilai_api.db.models.analytics_rule import RuleType, Severity


class RuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    rule_type: RuleType
    severity: Severity
    object_classes: list[str] | None = None
    zone_id: UUID | None = None
    line_id: UUID | None = None
    threshold_value: float | None = None
    cooldown_seconds: int = Field(default=30, ge=0)
    configuration: dict[str, Any] | None = None
    enabled: bool = True


class RuleCreate(RuleBase):
    pass


class RuleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    rule_type: RuleType | None = None
    severity: Severity | None = None
    object_classes: list[str] | None = None
    zone_id: UUID | None = None
    line_id: UUID | None = None
    threshold_value: float | None = None
    cooldown_seconds: int | None = Field(None, ge=0)
    configuration: dict[str, Any] | None = None
    enabled: bool | None = None


class RuleResponse(RuleBase):
    id: UUID
    camera_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
