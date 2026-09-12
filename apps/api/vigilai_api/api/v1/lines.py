from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.db.models.user import User
from vigilai_api.schemas.line import LineCreate, LineResponse, LineUpdate
from vigilai_api.services.camera import CameraService
from vigilai_api.services.line import LineService

router = APIRouter()


async def get_camera_dep(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    return await service.get_camera(camera_id, current_user.id)


@router.get("/{camera_id}/lines", response_model=list[LineResponse])
async def list_lines(
    camera_id: UUID, db: AsyncSession = Depends(get_db), camera=Depends(get_camera_dep)
):
    service = LineService(db)
    return await service.list_lines(camera_id)


@router.post("/{camera_id}/lines", response_model=LineResponse)
async def create_line(
    camera_id: UUID,
    line_in: LineCreate,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = LineService(db)
    return await service.create_line(camera_id, line_in.model_dump())


@router.get("/{camera_id}/lines/{line_id}", response_model=LineResponse)
async def get_line(
    camera_id: UUID,
    line_id: UUID,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = LineService(db)
    return await service.get_line(line_id, camera_id)


@router.put("/{camera_id}/lines/{line_id}", response_model=LineResponse)
async def update_line(
    camera_id: UUID,
    line_id: UUID,
    line_in: LineUpdate,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = LineService(db)
    return await service.update_line(line_id, camera_id, line_in.model_dump(exclude_unset=True))


@router.delete("/{camera_id}/lines/{line_id}")
async def delete_line(
    camera_id: UUID,
    line_id: UUID,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = LineService(db)
    await service.delete_line(line_id, camera_id)
    return {"msg": "Line deleted"}
