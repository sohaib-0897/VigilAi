from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.exceptions import NotFoundError, ValidationError
from vigilai_api.db.models.virtual_line import VirtualLine
from vigilai_api.repositories.line import LineRepository


class LineService:
    def __init__(self, session: AsyncSession):
        self.repo = LineRepository(session)

    def _validate_points(self, points: list[dict]):
        if len(points) != 2:
            raise ValidationError("Virtual line requires exactly 2 points")
        for point in points:
            if not (0 <= point.get("x", -1) <= 1 and 0 <= point.get("y", -1) <= 1):
                raise ValidationError("Coordinates must be normalized between 0 and 1")

    async def create_line(self, camera_id: UUID, data: dict) -> VirtualLine:
        if data["start_point"] == data["end_point"]:
            raise ValidationError("Line endpoints must differ")
        if "points" in data:
            self._validate_points(data["points"])
        return await self.repo.create(camera_id, **data)

    async def get_line(self, line_id: UUID, camera_id: UUID) -> VirtualLine:
        line = await self.repo.get_by_id(line_id, camera_id)
        if not line:
            raise NotFoundError("Virtual line not found")
        return line

    async def list_lines(self, camera_id: UUID) -> list[VirtualLine]:
        return await self.repo.list_by_camera(camera_id)

    async def update_line(self, line_id: UUID, camera_id: UUID, data: dict) -> VirtualLine:
        existing = await self.get_line(line_id, camera_id)
        if data.get("start_point", existing.start_point) == data.get(
            "end_point", existing.end_point
        ):
            raise ValidationError("Line endpoints must differ")
        if "points" in data:
            self._validate_points(data["points"])
        line = await self.repo.update(line_id, camera_id, **data)
        if not line:
            raise NotFoundError("Virtual line not found")
        return line

    async def delete_line(self, line_id: UUID, camera_id: UUID) -> bool:
        success = await self.repo.delete(line_id, camera_id)
        if not success:
            raise NotFoundError("Virtual line not found")
        return True
