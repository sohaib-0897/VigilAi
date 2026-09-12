from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.exceptions import NotFoundError, ValidationError
from vigilai_api.core.redis import redis_manager
from vigilai_api.db.models.camera import Camera
from vigilai_api.repositories.camera import CameraRepository


class CameraService:
    def __init__(self, session: AsyncSession):
        self.repo = CameraRepository(session)

    async def create_camera(self, user_id: UUID, data: dict) -> Camera:
        if data.get("source_type") == "rtsp":
            from vigilai_api.core.security import encrypt_string

            try:
                data["source_uri"] = "encrypted:" + encrypt_string(data["source_uri"])
            except ValueError as exc:
                raise ValidationError(str(exc)) from exc
        return await self.repo.create(user_id, **data)

    async def get_camera(self, camera_id: UUID, user_id: UUID) -> Camera:
        camera = await self.repo.get_by_id(camera_id, user_id)
        if not camera:
            raise NotFoundError("Camera not found")
        return camera

    async def list_cameras(
        self, user_id: UUID, page: int = 1, page_size: int = 20
    ) -> tuple[list[Camera], int]:
        return await self.repo.list_cameras(user_id, page, page_size)

    async def update_camera(self, camera_id: UUID, user_id: UUID, data: dict) -> Camera:
        existing = await self.get_camera(camera_id, user_id)
        if "source_uri" in data and data.get("source_type", existing.source_type) == "rtsp":
            from vigilai_api.core.security import encrypt_string

            try:
                data["source_uri"] = "encrypted:" + encrypt_string(data["source_uri"])
            except ValueError as exc:
                raise ValidationError(str(exc)) from exc
        camera = await self.repo.update(camera_id, user_id, **data)
        if not camera:
            raise NotFoundError("Camera not found")
        return camera

    async def delete_camera(self, camera_id: UUID, user_id: UUID) -> bool:
        success = await self.repo.delete(camera_id, user_id)
        if not success:
            raise NotFoundError("Camera not found")
        return True

    async def start_analytics(self, camera_id: UUID, user_id: UUID) -> Camera:
        camera = await self.get_camera(camera_id, user_id)
        if not camera.source_uri:
            raise ValidationError("Upload a video or configure a source first")
        await self.repo.update(camera_id, user_id, analytics_enabled=True)
        await self.repo.update_status(camera_id, "connecting")
        await redis_manager.publish_camera_command(str(camera_id), "start")
        return await self.get_camera(camera_id, user_id)

    async def stop_analytics(self, camera_id: UUID, user_id: UUID) -> Camera:
        camera = await self.get_camera(camera_id, user_id)
        await self.repo.update(camera_id, user_id, analytics_enabled=False)
        await redis_manager.publish_camera_command(str(camera_id), "stop")
        await self.repo.update_status(camera_id, "stopped")
        return await self.get_camera(camera_id, user_id)
