import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.config import get_settings
from vigilai_api.core.deps import get_db, get_stream_user_or_ticket, require_auth
from vigilai_api.core.exceptions import AuthenticationError, NotFoundError
from vigilai_api.core.redis import redis_manager
from vigilai_api.core.security import create_stream_ticket, verify_stream_ticket
from vigilai_api.db.models.user import User
from vigilai_api.db.session import async_session_maker
from vigilai_api.services.auth import AuthService
from vigilai_api.services.camera import CameraService

router = APIRouter()


async def frame_generator(camera_id: str, request: Request | None = None):
    """Generator for MJPEG stream with client disconnect handling."""
    while True:
        if request is not None and await request.is_disconnected():
            break
        frame = await redis_manager.get_camera_frame(camera_id)
        if frame:
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
        await asyncio.sleep(0.033)  # ~30fps


@router.post("/cameras/{camera_id}/stream-ticket")
async def create_camera_stream_ticket(
    camera_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_auth),
):
    """Generate a short-lived (60s), single-purpose stream ticket bound to camera and user.

    Prevents long-lived access token exposure in <img> tags, browser history, and proxy logs.
    """
    await CameraService(db).get_camera(camera_id, user.id)
    ticket = create_stream_ticket(user_id=str(user.id), camera_id=str(camera_id), expires_seconds=60)
    return {"ticket": ticket, "expires_in": 60, "camera_id": str(camera_id)}


@router.get("/cameras/{camera_id}/stream")
async def video_stream(
    request: Request,
    camera_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_stream_user_or_ticket),
):
    await CameraService(db).get_camera(camera_id, user.id)
    return StreamingResponse(
        frame_generator(str(camera_id), request), media_type="multipart/x-mixed-replace; boundary=frame"
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
        user = await socket_user(websocket, expected_camera_id=str(camera_id))
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


async def socket_user(websocket: WebSocket, expected_camera_id: str | None = None) -> User:
    origin = websocket.headers.get("origin")
    if origin and origin not in get_settings().CORS_ORIGINS:
        raise AuthenticationError("Origin not allowed")

    # Explicitly reject long-lived access token query parameters
    if websocket.query_params.get("token"):
        raise AuthenticationError(
            "Access tokens are prohibited in WebSocket URLs. "
            "Use authenticated cookies or short-lived stream tickets (?ticket=...)."
        )

    # 1. Check HttpOnly cookie
    token = websocket.cookies.get("access_token", "")
    if token:
        async with async_session_maker() as db:
            return await AuthService(db).get_current_user(token)

    # 2. Check stream ticket parameter
    ticket = websocket.query_params.get("ticket")
    if ticket:
        ticket_data = verify_stream_ticket(ticket, expected_camera_id=expected_camera_id)
        if not ticket_data:
            raise AuthenticationError("Invalid or expired stream ticket")
        async with async_session_maker() as db:
            from sqlalchemy import select

            result = await db.execute(select(User).where(User.id == ticket_data.sub))
            user = result.scalars().first()
            if not user or not user.is_active:
                raise AuthenticationError("User inactive or not found")
            return user

    raise AuthenticationError("Authentication required")
