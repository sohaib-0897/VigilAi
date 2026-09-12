import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.config import get_settings
from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.core.exceptions import AuthenticationError, NotFoundError
from vigilai_api.core.redis import redis_manager
from vigilai_api.db.session import async_session_maker
from vigilai_api.services.auth import AuthService
from vigilai_api.services.camera import CameraService

router = APIRouter()


async def frame_generator(camera_id: str):
    """Generator for MJPEG stream."""
    while True:
        frame = await redis_manager.get_camera_frame(camera_id)
        if frame:
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
        await asyncio.sleep(0.033)  # ~30fps


@router.get("/cameras/{camera_id}/stream")
async def video_stream(
    camera_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(require_auth)
):
    await CameraService(db).get_camera(camera_id, user.id)
    # In a real app we might validate access token from query params or cookies since SSE/MJPEG
    # doesn't easily support auth headers in all contexts.
    return StreamingResponse(
        frame_generator(str(camera_id)), media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    try:
        user = await socket_user(websocket)
    except (AuthenticationError, ValueError):
        await websocket.close(code=4401)
        return
    await websocket.accept()

    async def forward():
        async for message in redis_manager.subscribe("vigilai:events"):
            async with async_session_maker() as db:
                try:
                    await CameraService(db).get_camera(UUID(message["camera_id"]), user.id)
                except (NotFoundError, ValueError, KeyError):
                    continue
            await websocket.send_json(message)

    task = asyncio.create_task(forward())
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)


@router.websocket("/ws/cameras/{camera_id}/status")
async def websocket_camera_status(websocket: WebSocket, camera_id: UUID):
    try:
        user = await socket_user(websocket)
        async with async_session_maker() as db:
            await CameraService(db).get_camera(camera_id, user.id)
    except (AuthenticationError, NotFoundError, ValueError):
        await websocket.close(code=4403)
        return
    await websocket.accept()
    try:
        while True:
            status = await redis_manager.get_camera_status(str(camera_id))
            await websocket.send_json(status or {"status": "offline"})
            await asyncio.sleep(1)
    except (WebSocketDisconnect, RuntimeError):
        return


async def socket_user(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if origin and origin not in get_settings().CORS_ORIGINS:
        raise AuthenticationError("Origin not allowed")
    async with async_session_maker() as db:
        return await AuthService(db).get_current_user(websocket.cookies.get("access_token", ""))
