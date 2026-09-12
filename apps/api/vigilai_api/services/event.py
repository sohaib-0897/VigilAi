from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.exceptions import NotFoundError
from vigilai_api.db.models.event import Event
from vigilai_api.repositories.event import EventRepository


class EventService:
    def __init__(self, session: AsyncSession, user_id: UUID):
        self.repo = EventRepository(session, user_id)

    async def get_event(self, event_id: UUID) -> Event:
        event = await self.repo.get_by_id(event_id)
        if not event:
            raise NotFoundError("Event not found")
        return event

    async def list_events(
        self, filters: dict[str, Any], page: int = 1, page_size: int = 20
    ) -> tuple[list[Event], int]:
        return await self.repo.list_events(filters, page, page_size)

    async def update_event_status(self, event_id: UUID, status: str) -> Event:
        event = await self.repo.update_status(event_id, status)
        if not event:
            raise NotFoundError("Event not found")
        return event
