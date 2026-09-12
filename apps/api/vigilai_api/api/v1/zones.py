from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.db.models.user import User
from vigilai_api.schemas.zone import ZoneCreate, ZoneResponse, ZoneUpdate
from vigilai_api.services.camera import CameraService
from vigilai_api.services.zone import ZoneService

router = APIRouter()


async def get_camera_dep(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    return await service.get_camera(camera_id, current_user.id)


@router.get("/{camera_id}/zones", response_model=list[ZoneResponse])
async def list_zones(
    camera_id: UUID, db: AsyncSession = Depends(get_db), camera=Depends(get_camera_dep)
):
    service = ZoneService(db)
    return await service.list_zones(camera_id)


@router.post("/{camera_id}/zones", response_model=ZoneResponse)
async def create_zone(
    camera_id: UUID,
    zone_in: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = ZoneService(db)
    return await service.create_zone(camera_id, zone_in.model_dump())


@router.get("/{camera_id}/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    camera_id: UUID,
    zone_id: UUID,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = ZoneService(db)
    return await service.get_zone(zone_id, camera_id)


@router.put("/{camera_id}/zones/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    camera_id: UUID,
    zone_id: UUID,
    zone_in: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = ZoneService(db)
    return await service.update_zone(zone_id, camera_id, zone_in.model_dump(exclude_unset=True))


@router.delete("/{camera_id}/zones/{zone_id}")
async def delete_zone(
    camera_id: UUID,
    zone_id: UUID,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = ZoneService(db)
    await service.delete_zone(zone_id, camera_id)
    return {"msg": "Zone deleted"}
