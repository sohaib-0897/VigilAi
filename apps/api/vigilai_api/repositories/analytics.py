from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.camera import Camera
from vigilai_api.db.models.event import Event
from vigilai_api.db.models.track_summary import TrackSummary


class AnalyticsRepository:
    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def get_overview_stats(self, user_id: UUID) -> dict[str, Any]:
        # Count cameras
        cameras_result = await self.session.execute(
            select(func.count()).select_from(Camera).where(Camera.user_id == user_id)
        )
        total_cameras = cameras_result.scalar() or 0

        active_cameras_result = await self.session.execute(
            select(func.count())
            .select_from(Camera)
            .where(Camera.user_id == user_id, Camera.status == "online")
        )
        active_cameras = active_cameras_result.scalar() or 0

        # Events today - join with camera to filter by user ownership
        today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        events_today_query = (
            select(func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(Camera.user_id == user_id, Event.started_at >= today)
        )
        events_today_result = await self.session.execute(events_today_query)
        events_today = events_today_result.scalar() or 0

        # Critical events today
        critical_query = (
            select(func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(
                Camera.user_id == user_id, Event.started_at >= today, Event.severity == "critical"
            )
        )
        critical_result = await self.session.execute(critical_query)
        critical_events = critical_result.scalar() or 0

        return {
            "total_cameras": total_cameras,
            "active_cameras": active_cameras,
            "events_today": events_today,
            "critical_events": critical_events,
        }

    async def get_object_counts(
        self, camera_id: UUID | None, start: datetime, end: datetime
    ) -> dict[str, int]:
        """Aggregate object counts from track summaries within the time range."""
        query = (
            select(TrackSummary.object_class, func.count())
            .select_from(TrackSummary)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(TrackSummary.first_seen >= start, TrackSummary.last_seen <= end)
        )
        if camera_id:
            query = query.where(TrackSummary.camera_id == camera_id)
        query = query.group_by(TrackSummary.object_class)
        result = await self.session.execute(query)
        counts = {row[0]: row[1] for row in result.all()}
        return counts if counts else {}

    async def get_events_timeseries(
        self, camera_id: UUID | None, start: datetime, end: datetime, interval: str
    ) -> list[Any]:
        query = (
            select(func.date_trunc(interval, Event.started_at).label("period"), func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
        )
        if camera_id:
            query = query.where(Event.camera_id == camera_id)
        query = (
            query.where(Event.started_at >= start, Event.started_at <= end)
            .group_by("period")
            .order_by("period")
        )
        result = await self.session.execute(query)
        return [{"period": str(row[0]), "count": row[1]} for row in result.all()]

    async def get_event_type_distribution(
        self, camera_id: UUID | None, start: datetime, end: datetime
    ) -> dict[str, int]:
        query = (
            select(Event.event_type, func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(Event.started_at >= start, Event.started_at <= end)
        )
        if camera_id:
            query = query.where(Event.camera_id == camera_id)
        query = query.group_by(Event.event_type)
        result = await self.session.execute(query)
        return {row[0]: row[1] for row in result.all()}

    async def get_camera_activity(self, user_id: UUID) -> list[Any]:
        """Get per-camera event counts for the user's cameras."""
        query = (
            select(Camera.name, func.count(Event.id))
            .select_from(Camera)
            .outerjoin(Event)
            .where(Camera.user_id == user_id)
            .group_by(Camera.id, Camera.name)
        )
        result = await self.session.execute(query)
        return [{"camera_name": row[0], "event_count": row[1]} for row in result.all()]
