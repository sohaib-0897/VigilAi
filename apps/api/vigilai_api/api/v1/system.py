from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.core.redis import redis_manager
from vigilai_api.db.models.user import User
from vigilai_api.schemas.system import SystemHealth, SystemMetrics

router = APIRouter()


@router.get("/health", response_model=SystemHealth)
async def system_health(db: AsyncSession = Depends(get_db)):
    status = "healthy"
    details = {}

    # Check DB
    try:
        await db.execute(text("SELECT 1"))
        details["database"] = "ok"
    except Exception:
        status = "degraded"
        details["database"] = "unavailable"

    # Check Redis
    try:
        if redis_manager.client and await redis_manager.client.ping():
            details["redis"] = "ok"
        else:
            status = "degraded"
            details["redis"] = "unavailable"
    except Exception:
        status = "degraded"
        details["redis"] = "unavailable"

    return {"status": status, "version": "1.0.0", "details": details}


@router.get("/metrics", response_model=SystemMetrics)
async def system_metrics(current_user: User = Depends(require_auth)):
    import json

    workers = []
    if redis_manager.client:
        async for key in redis_manager.client.scan_iter("worker:*:status"):
            raw = await redis_manager.client.get(key)
            if raw:
                try:
                    workers.append(json.loads(raw))
                except Exception:
                    pass

    total_processed = 0
    total_dropped = 0
    fps_list = []

    for w in workers:
        pstats = w.get("pipeline_stats", {})
        if isinstance(pstats, dict):
            for cam_id, stats in pstats.items():
                if isinstance(stats, dict):
                    total_processed += stats.get("frames_processed", 0)
                    total_dropped += stats.get("frames_dropped", 0)
                    if "fps" in stats and stats["fps"] is not None:
                        fps_list.append(float(stats["fps"]))

    avg_fps = round(sum(fps_list) / len(fps_list), 2) if fps_list else None

    return {
        "workers": len(workers),
        "cpu_usage_percent": workers[0]["cpu_percent"] if workers else None,
        "memory_usage_percent": workers[0]["memory_percent"] if workers else None,
        "active_streams": sum(w.get("active_cameras", 0) for w in workers) if workers else None,
        "frames_processed": total_processed if workers else None,
        "frames_dropped": total_dropped if workers else None,
        "pipeline_fps": avg_fps,
    }
