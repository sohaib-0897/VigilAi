from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_cameras: int
    active_cameras: int
    events_today: int
    events_by_severity: dict[str, int]
    people_count: int
    vehicle_count: int


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    count: int


class TimeseriesResponse(BaseModel):
    data_points: list[TimeseriesPoint]
    period: str


class AnalyticsFilter(BaseModel):
    camera_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    period: str | None = "1h"
