from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.repositories.analytics import AnalyticsRepository
from vigilai_api.repositories.event import EventRepository


class AnalyticsService:
    def __init__(self, session: AsyncSession, user_id: UUID):
        self.repo = AnalyticsRepository(session, user_id)
        self.event_repo = EventRepository(session, user_id)

    async def get_overview(self, user_id: UUID) -> dict[str, Any]:
        stats = await self.repo.get_overview_stats(user_id)

        # Get severity distribution
        events_by_severity = await self.event_repo.get_events_by_severity()

        # Get recent events
        recent_events = await self.event_repo.get_recent_events(limit=10)

        # Get object counts for today
        today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        now = datetime.now(UTC)
        object_counts = await self.repo.get_object_counts(None, today, now)

        stats["events_by_severity"] = events_by_severity
        stats["people_count"] = object_counts.get("person", 0)
        stats["vehicle_count"] = (
            object_counts.get("car", 0)
            + object_counts.get("truck", 0)
            + object_counts.get("bus", 0)
            + object_counts.get("motorcycle", 0)
        )
        stats["high_severity_events"] = events_by_severity.get("high", 0) + events_by_severity.get(
            "critical", 0
        )
        stats["recent_events"] = recent_events

        return stats

    async def get_timeseries(
        self, start: datetime, end: datetime, interval: str, camera_id: UUID | None
    ) -> list[Any]:
        return await self.repo.get_events_timeseries(camera_id, start, end, interval)

    async def get_distribution(
        self, start: datetime, end: datetime, camera_id: UUID | None
    ) -> dict[str, int]:
        return await self.repo.get_event_type_distribution(camera_id, start, end)
