from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.virtual_line import VirtualLine


class LineRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, camera_id: UUID, **data) -> VirtualLine:
        line = VirtualLine(camera_id=camera_id, **data)
        self.session.add(line)
        await self.session.commit()
        await self.session.refresh(line)
        return line

    async def get_by_id(self, line_id: UUID, camera_id: UUID) -> VirtualLine | None:
        query = select(VirtualLine).where(
            VirtualLine.id == line_id, VirtualLine.camera_id == camera_id
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def list_by_camera(self, camera_id: UUID) -> list[VirtualLine]:
        query = select(VirtualLine).where(VirtualLine.camera_id == camera_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def update(self, line_id: UUID, camera_id: UUID, **data) -> VirtualLine | None:
        line = await self.get_by_id(line_id, camera_id)
        if not line:
            return None
        for key, value in data.items():
            setattr(line, key, value)
        await self.session.commit()
        await self.session.refresh(line)
        return line

    async def delete(self, line_id: UUID, camera_id: UUID) -> bool:
        line = await self.get_by_id(line_id, camera_id)
        if not line:
            return False
        await self.session.delete(line)
        await self.session.commit()
        return True
