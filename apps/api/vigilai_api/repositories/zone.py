from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.zone import Zone


class ZoneRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, camera_id: UUID, **data) -> Zone:
        zone = Zone(camera_id=camera_id, **data)
        self.session.add(zone)
        await self.session.commit()
        await self.session.refresh(zone)
        return zone

    async def get_by_id(self, zone_id: UUID, camera_id: UUID) -> Zone | None:
        query = select(Zone).where(Zone.id == zone_id, Zone.camera_id == camera_id)
        result = await self.session.execute(query)
        return result.scalars().first()

    async def list_by_camera(self, camera_id: UUID) -> list[Zone]:
        query = select(Zone).where(Zone.camera_id == camera_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, zone_id: UUID, camera_id: UUID, **data) -> Zone | None:
        zone = await self.get_by_id(zone_id, camera_id)
        if not zone:
            return None
        for key, value in data.items():
            setattr(zone, key, value)
        await self.session.commit()
        await self.session.refresh(zone)
        return zone

    async def delete(self, zone_id: UUID, camera_id: UUID) -> bool:
        zone = await self.get_by_id(zone_id, camera_id)
        if not zone:
            return False
        await self.session.delete(zone)
        await self.session.commit()
        return True
