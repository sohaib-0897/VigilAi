import os
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.db.models.user import User
from vigilai_api.schemas.camera import (
    CameraCreate,
    CameraListResponse,
    CameraResponse,
    CameraUpdate,
)
from vigilai_api.services.camera import CameraService

router = APIRouter()

from vigilai_api.core.config import get_settings

UPLOAD_DIR = get_settings().UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("", response_model=CameraListResponse)
async def list_cameras(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    service = CameraService(db)
    cameras, total = await service.list_cameras(current_user.id, page, page_size)
    return {
        "items": cameras,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post("", response_model=CameraResponse)
async def create_camera(
    camera_in: CameraCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    service = CameraService(db)
    return await service.create_camera(current_user.id, camera_in.model_dump())


@router.post("/demo", response_model=CameraResponse)
async def create_demo_camera(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    """Create or return the user's camera for the bundled, server-selected demo video."""
    demo_path = Path(get_settings().DEMO_VIDEO_PATH).resolve()
    if not demo_path.is_file():
        raise HTTPException(
            status_code=503,
            detail="Bundled demo video is unavailable on this deployment",
        )
    service = CameraService(db)
    return await service.get_or_create_demo_camera(current_user.id, str(demo_path))


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    return await service.get_camera(camera_id, current_user.id)


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: UUID,
    camera_in: CameraUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    service = CameraService(db)
    return await service.update_camera(
        camera_id, current_user.id, camera_in.model_dump(exclude_unset=True)
    )


@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    await service.delete_camera(camera_id, current_user.id)
    return {"msg": "Camera deleted successfully"}


@router.post("/{camera_id}/start")
async def start_camera(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    await service.start_analytics(camera_id, current_user.id)
    return {"msg": "Analytics started"}


@router.post("/{camera_id}/stop")
async def stop_camera(
    camera_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = CameraService(db)
    await service.stop_analytics(camera_id, current_user.id)
    return {"msg": "Analytics stopped"}


@router.post("/{camera_id}/upload")
async def upload_video(
    camera_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    service = CameraService(db)
    camera = await service.get_camera(camera_id, current_user.id)

    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in ["mp4", "avi", "mov", "mkv"]:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    filename = f"{uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    import aiofiles

    from vigilai_api.core.config import get_settings

    size = 0
    try:
        async with aiofiles.open(filepath, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > get_settings().MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                    raise HTTPException(413, "Upload exceeds configured size limit")
                await f.write(chunk)
        import asyncio

        import cv2

        def valid_video():
            cap = cv2.VideoCapture(filepath)
            try:
                ok, frame = cap.read()
                return ok and frame is not None
            finally:
                cap.release()

        if not await asyncio.to_thread(valid_video):
            raise HTTPException(400, "File cannot be decoded as video")
    except Exception:
        if os.path.isfile(filepath):
            os.remove(filepath)
        raise

    # Update camera with local path
    await service.update_camera(
        camera_id, current_user.id, {"source_uri": filepath, "source_type": "local_video"}
    )

    return {"msg": "Video uploaded successfully", "path": filepath}
