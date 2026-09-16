import csv
import io
import json
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from vigilai_api.core.config import get_settings
from vigilai_api.core.deps import get_db, require_auth
from vigilai_api.db.models.event import EventStatus
from vigilai_api.db.models.user import User
from vigilai_api.schemas.event import EventListResponse, EventResponse
from vigilai_api.services.event import EventService

router = APIRouter()


class EventStatusUpdate(BaseModel):
    status: EventStatus


@router.get("", response_model=EventListResponse)
async def list_events(
    camera_id: UUID | None = None,
    event_type: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    filters = {
        "camera_id": camera_id,
        "event_type": event_type,
        "severity": severity,
        "status": status,
    }
    # Clean None values
    filters = {k: v for k, v in filters.items() if v is not None}

    service = EventService(db, current_user.id)
    events, total = await service.list_events(filters, page, page_size)
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {"items": events, "total": total, "page": page, "page_size": page_size, "pages": pages}


@router.get("/export")
async def export_events(
    format: str = Query("csv", pattern="^(csv|json)$"),
    camera_id: UUID | None = None,
    event_type: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    filters = {
        "camera_id": camera_id,
        "event_type": event_type,
        "severity": severity,
        "status": status,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    service = EventService(db, current_user.id)
    events, _ = await service.list_events(filters, page=1, page_size=1000)

    if format == "json":
        data = [
            {
                "id": str(e.id),
                "camera_id": str(e.camera_id),
                "rule_id": str(e.rule_id) if e.rule_id else None,
                "event_type": e.event_type,
                "severity": str(e.severity.value) if hasattr(e.severity, "value") else str(e.severity),
                "object_class": e.object_class,
                "track_id": e.track_id,
                "status": str(e.status.value) if hasattr(e.status, "value") else str(e.status),
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "ended_at": e.ended_at.isoformat() if e.ended_at else None,
                "fingerprint": e.fingerprint,
                "metadata": e.metadata_,
            }
            for e in events
        ]
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=vigilai_events_export.json"},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID",
        "Started At",
        "Ended At",
        "Camera ID",
        "Event Type",
        "Severity",
        "Object Class",
        "Track ID",
        "Status",
        "Fingerprint",
    ])
    for e in events:
        sev = e.severity.value if hasattr(e.severity, "value") else str(e.severity)
        st = e.status.value if hasattr(e.status, "value") else str(e.status)
        writer.writerow([
            str(e.id),
            e.started_at.isoformat() if e.started_at else "",
            e.ended_at.isoformat() if e.ended_at else "",
            str(e.camera_id),
            e.event_type,
            sev,
            e.object_class or "",
            str(e.track_id or ""),
            st,
            e.fingerprint or "",
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vigilai_events_export.csv"},
    )



@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_auth)
):
    service = EventService(db, current_user.id)
    return await service.get_event(event_id)


@router.patch("/{event_id}/status", response_model=EventResponse)
async def update_event_status(
    event_id: UUID,
    status_update: EventStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    service = EventService(db, current_user.id)
    return await service.update_event_status(event_id, status_update.status)


@router.get("/{event_id}/evidence/{evidence_id}/file")
async def get_evidence_file(
    event_id: UUID,
    evidence_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    await EventService(db, current_user.id).get_event(event_id)
    # Retrieve evidence from DB
    from vigilai_api.repositories.evidence import EvidenceRepository

    repo = EvidenceRepository(db)
    evidence = await repo.get_by_id(evidence_id)
    if not evidence or evidence.event_id != event_id:
        raise HTTPException(status_code=404, detail="Evidence not found")

    path = Path(evidence.file_path).resolve()
    if not path.is_relative_to(Path(get_settings().EVIDENCE_DIR).resolve()) or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(evidence.file_path)
