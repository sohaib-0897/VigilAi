from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.camera import Camera
from vigilai_api.db.models.event import Event


class EventRepository:
    def __init__(self, session: AsyncSession, user_id: UUID):
        self.session = session
        self.user_id = user_id

    async def create(self, **data) -> Event:
        event = Event(**data)
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return event

    async def get_by_id(self, event_id: UUID) -> Event | None:
        query = (
            select(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(Event.id == event_id)
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def list_events(
        self, filters: dict[str, Any], page: int = 1, page_size: int = 20
    ) -> tuple[list[Event], int]:
        offset = (page - 1) * page_size

        query = select(Event).join(Camera).where(Camera.user_id == self.user_id)
        if filters.get("camera_id"):
            query = query.where(Event.camera_id == filters["camera_id"])
        if filters.get("event_type"):
            query = query.where(Event.event_type == filters["event_type"])
        if filters.get("severity"):
            query = query.where(Event.severity == filters["severity"])
        if filters.get("status"):
            query = query.where(Event.status == filters["status"])

        count_query = select(func.count()).select_from(query.subquery())
        total = await self.session.execute(count_query)
        total_count = total.scalar() or 0

        query = query.order_by(desc(Event.started_at)).offset(offset).limit(page_size)
        result = await self.session.execute(query)

        return list(result.scalars().all()), total_count

    async def update_status(self, event_id: UUID, status: str) -> Event | None:
        event = await self.get_by_id(event_id)
        if not event:
            return None
        event.status = status
        await self.session.commit()
        await self.session.refresh(event)
        return event

    async def get_events_today(self, camera_id: UUID | None = None) -> int:
        today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        query = (
            select(func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(Event.started_at >= today)
        )
        if camera_id:
            query = query.where(Event.camera_id == camera_id)
        result = await self.session.execute(query)
        return result.scalar() or 0

    async def get_events_by_severity(self, camera_id: UUID | None = None) -> dict[str, int]:
        query = (
            select(Event.severity, func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .group_by(Event.severity)
        )
        if camera_id:
            query = query.where(Event.camera_id == camera_id)
        result = await self.session.execute(query)
        return {row[0]: row[1] for row in result.all()}

    async def get_events_timeseries(
        self, start: datetime, end: datetime, interval: str, camera_id: UUID | None
    ) -> list[Any]:
        query = (
            select(func.date_trunc(interval, Event.started_at).label("period"), func.count())
            .select_from(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .where(Event.started_at >= start, Event.started_at <= end)
        )
        if camera_id:
            query = query.where(Event.camera_id == camera_id)
        query = query.group_by("period").order_by("period")
        result = await self.session.execute(query)
        return [{"period": row[0], "count": row[1]} for row in result.all()]

    async def get_recent_events(self, limit: int = 10) -> list[Event]:
        query = (
            select(Event)
            .join(Camera)
            .where(Camera.user_id == self.user_id)
            .order_by(desc(Event.started_at))
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
