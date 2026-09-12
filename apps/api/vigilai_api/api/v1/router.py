from fastapi import APIRouter

from vigilai_api.api.v1 import (
    analytics,
    auth,
    cameras,
    events,
    lines,
    rules,
    streaming,
    system,
    zones,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(cameras.router, prefix="/cameras", tags=["cameras"])
# Nested routers inside cameras.router or separate
api_router.include_router(zones.router, prefix="/cameras", tags=["zones"])
api_router.include_router(lines.router, prefix="/cameras", tags=["lines"])
api_router.include_router(rules.router, prefix="/cameras", tags=["rules"])

api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(streaming.router, tags=["streaming"])  # Streaming has its own paths
