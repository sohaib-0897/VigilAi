from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.db.models.user import User
from vigilai_api.services.analytics import AnalyticsService

router = APIRouter()


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = AnalyticsService(db, current_user.id)
    return await service.get_overview(current_user.id)


@router.get("/timeseries")
async def get_timeseries(
    start: datetime | None = None,
    end: datetime | None = None,
    interval: str = Query("day", pattern="^(hour|day|week|month)$"),
    camera_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    if not end:
        end = datetime.now(UTC)
    if not start:
        start = end - timedelta(days=7)

    service = AnalyticsService(db, current_user.id)
    return await service.get_timeseries(start, end, interval, camera_id)


@router.get("/distribution")
async def get_distribution(
    start: datetime | None = None,
    end: datetime | None = None,
    camera_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    if not end:
        end = datetime.now(UTC)
    if not start:
        start = end - timedelta(days=7)

    service = AnalyticsService(db, current_user.id)
    return await service.get_distribution(start, end, camera_id)
