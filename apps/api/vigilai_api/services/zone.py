from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.exceptions import NotFoundError, ValidationError
from vigilai_api.db.models.zone import Zone
from vigilai_api.repositories.zone import ZoneRepository


class ZoneService:
    def __init__(self, session: AsyncSession):
        self.repo = ZoneRepository(session)

    def _validate_points(self, points: list[dict]):
        from vigilai_api.cv.geometry.core import validate_polygon

        if not validate_polygon([(p["x"], p["y"]) for p in points]):
            raise ValidationError(
                "Polygon must be simple, nondegenerate, and have distinct vertices"
            )
        if len(points) < 3:
            raise ValidationError("Zone requires at least 3 points")
        for point in points:
            if not (0 <= point.get("x", -1) <= 1 and 0 <= point.get("y", -1) <= 1):
                raise ValidationError("Coordinates must be normalized between 0 and 1")

    async def create_zone(self, camera_id: UUID, data: dict) -> Zone:
        if "points" in data:
            self._validate_points(data["points"])
        return await self.repo.create(camera_id, **data)

    async def get_zone(self, zone_id: UUID, camera_id: UUID) -> Zone:
        zone = await self.repo.get_by_id(zone_id, camera_id)
        if not zone:
            raise NotFoundError("Zone not found")
        return zone

    async def list_zones(self, camera_id: UUID) -> list[Zone]:
        return await self.repo.list_by_camera(camera_id)

    async def update_zone(self, zone_id: UUID, camera_id: UUID, data: dict) -> Zone:
        if "points" in data:
            self._validate_points(data["points"])
        zone = await self.repo.update(zone_id, camera_id, **data)
        if not zone:
            raise NotFoundError("Zone not found")
        return zone

    async def delete_zone(self, zone_id: UUID, camera_id: UUID) -> bool:
        success = await self.repo.delete(zone_id, camera_id)
        if not success:
            raise NotFoundError("Zone not found")
        return True
