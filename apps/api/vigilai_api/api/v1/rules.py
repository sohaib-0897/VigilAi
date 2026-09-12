from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.db.models.user import User
from vigilai_api.schemas.rule import RuleCreate, RuleResponse, RuleUpdate
from vigilai_api.services.camera import CameraService
from vigilai_api.services.rule import RuleService

router = APIRouter()


async def get_camera_dep(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    return await service.get_camera(camera_id, current_user.id)


@router.get("/{camera_id}/rules", response_model=list[RuleResponse])
async def list_rules(
    camera_id: UUID, db: AsyncSession = Depends(get_db), camera=Depends(get_camera_dep)
):
    service = RuleService(db)
    return await service.list_rules(camera_id)


@router.post("/{camera_id}/rules", response_model=RuleResponse)
async def create_rule(
    camera_id: UUID,
    rule_in: RuleCreate,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = RuleService(db)
    return await service.create_rule(camera_id, rule_in.model_dump())


@router.get("/{camera_id}/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(
    camera_id: UUID,
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = RuleService(db)
    return await service.get_rule(rule_id, camera_id)


@router.put("/{camera_id}/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    camera_id: UUID,
    rule_id: UUID,
    rule_in: RuleUpdate,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = RuleService(db)
    return await service.update_rule(rule_id, camera_id, rule_in.model_dump(exclude_unset=True))


@router.delete("/{camera_id}/rules/{rule_id}")
async def delete_rule(
    camera_id: UUID,
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    camera=Depends(get_camera_dep),
):
    service = RuleService(db)
    await service.delete_rule(rule_id, camera_id)
    return {"msg": "Rule deleted"}
