from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.db.models.camera import Camera


class CameraRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, camera_id: UUID, user_id: UUID | None = None) -> Camera | None:
        query = select(Camera).where(Camera.id == camera_id)
        if user_id:
            query = query.where(Camera.user_id == user_id)
        result = await self.session.execute(query)
        return result.scalars().first()

    async def list_cameras(
        self, user_id: UUID, page: int = 1, page_size: int = 20
    ) -> tuple[list[Camera], int]:
        offset = (page - 1) * page_size

        count_query = select(func.count()).select_from(Camera).where(Camera.user_id == user_id)
        total = await self.session.execute(count_query)
        total_count = total.scalar() or 0

        query = select(Camera).where(Camera.user_id == user_id).offset(offset).limit(page_size)
        result = await self.session.execute(query)

        return list(result.scalars().all()), total_count

    async def create(self, user_id: UUID, **data) -> Camera:
        camera = Camera(user_id=user_id, **data)
        self.session.add(camera)
        await self.session.commit()
        await self.session.refresh(camera)
        return camera

    async def update(self, camera_id: UUID, user_id: UUID, **data) -> Camera | None:
        camera = await self.get_by_id(camera_id, user_id)
        if not camera:
            return None
        for key, value in data.items():
            setattr(camera, key, value)
        await self.session.commit()
        await self.session.refresh(camera)
        return camera

    async def delete(self, camera_id: UUID, user_id: UUID) -> bool:
        camera = await self.get_by_id(camera_id, user_id)
        if not camera:
            return False
        await self.session.delete(camera)
        await self.session.commit()
        return True

    async def update_status(self, camera_id: UUID, status: str, message: str | None = None) -> None:
        camera = await self.get_by_id(camera_id)
        if camera:
            camera.status = status
            if message:
                camera.status_message = message
            await self.session.commit()

    async def get_active_cameras(self) -> list[Camera]:
        query = select(Camera).where(Camera.enabled == True)
        result = await self.session.execute(query)
        return list(result.scalars().all())
