import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from vigilai_api.core.security import decrypt_string
from vigilai_api.db.models.camera import Camera, CameraStatus
from vigilai_api.db.models import (
    AnalyticsRule,
    CameraSession,
    Event,
    Evidence,
    TrackSummary,
    VirtualLine,
    Zone,
)

from apps.worker.config import settings

logger = logging.getLogger(__name__)

# Create sync engine for the worker (which uses threads)
engine = create_engine(
    settings.database_sync_url, pool_pre_ping=True, pool_size=10, max_overflow=20
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def load_camera(camera_id: str) -> dict[str, Any]:
    with SessionLocal() as session:
        camera = session.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            return {}
        return {
            "id": str(camera.id),
            "name": camera.name,
            "source_type": camera.source_type,
            "source_uri": decrypt_string(camera.source_uri[10:])
            if camera.source_uri.startswith("encrypted:")
            else camera.source_uri,
            "enabled": camera.enabled,
            "fps": camera.fps,
            "width": camera.width,
            "height": camera.height,
            "model_id": getattr(camera, "model_id", "coco-yolov8n-onnx") or "coco-yolov8n-onnx",
        }


def desired_cameras() -> list[str]:
    with SessionLocal() as session:
        return [
            str(c.id)
            for c in session.query(Camera)
            .filter(Camera.analytics_enabled.is_(True), Camera.enabled.is_(True))
            .all()
        ]


def finish_camera(camera_id: str) -> None:
    with SessionLocal() as session:
        camera = session.get(Camera, UUID(camera_id))
        if camera:
            camera.analytics_enabled = False
            session.commit()


def load_zones(camera_id: str) -> list[dict[str, Any]]:
    with SessionLocal() as session:
        zones = session.query(Zone).filter(Zone.camera_id == camera_id, Zone.enabled == True).all()
        return [
            {"id": str(z.id), "name": z.name, "points": z.points, "color": z.color} for z in zones
        ]


def load_lines(camera_id: str) -> list[dict[str, Any]]:
    with SessionLocal() as session:
        lines = (
            session.query(VirtualLine)
            .filter(VirtualLine.camera_id == camera_id, VirtualLine.enabled == True)
            .all()
        )
        return [
            {
                "id": str(l.id),
                "name": l.name,
                "start_point": l.start_point,
                "end_point": l.end_point,
                "direction_mode": l.direction_mode,
                "color": l.color,
            }
            for l in lines
        ]


def load_rules(camera_id: str) -> list[dict[str, Any]]:
    with SessionLocal() as session:
        rules = (
            session.query(AnalyticsRule)
            .filter(AnalyticsRule.camera_id == camera_id, AnalyticsRule.enabled == True)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "name": r.name,
                "rule_type": r.rule_type,
                "severity": r.severity,
                "configuration": r.configuration,
                "zone_id": str(r.zone_id) if r.zone_id else None,
                "line_id": str(r.line_id) if r.line_id else None,
                "object_classes": r.object_classes,
                "threshold_value": r.threshold_value,
                "cooldown_seconds": r.cooldown_seconds,
            }
            for r in rules
        ]


def save_event(event_data: dict[str, Any]) -> str:
    with SessionLocal() as session:
        event_data = dict(event_data)
        for key in ("started_at", "ended_at"):
            if isinstance(event_data.get(key), (int, float)):
                event_data[key] = datetime.fromtimestamp(event_data[key], UTC)
        event_data["metadata_"] = event_data.pop("metadata", {})
        event = session.get(Event, UUID(str(event_data["id"])))
        if event is None:
            event = Event(**event_data)
            session.add(event)
        else:
            event.ended_at = event_data.get("ended_at")
            if event.status not in ("acknowledged", "dismissed"):
                event.status = event_data["status"]
        session.commit()
        session.refresh(event)
        return str(event.id)


def save_evidence(evidence_data: dict[str, Any]) -> str:
    with SessionLocal() as session:
        evidence_data = dict(evidence_data)
        evidence_data["metadata_"] = evidence_data.pop("metadata", {})
        evidence = Evidence(**evidence_data)
        session.add(evidence)
        session.commit()
        session.refresh(evidence)
        return str(evidence.id)


def update_camera_status(camera_id: str, status: str, message: str = "") -> None:
    with SessionLocal() as session:
        cid = UUID(str(camera_id))
        camera = session.get(Camera, cid)
        if camera:
            try:
                camera.status = CameraStatus(status)
            except Exception:
                camera.status = status
            if message is not None:
                camera.status_message = message
            session.commit()


def save_session(session_data: dict[str, Any]) -> str:
    with SessionLocal() as session:
        cam_session = CameraSession(**session_data)
        session.add(cam_session)
        session.commit()
        session.refresh(cam_session)
        return str(cam_session.id)


def save_track_summary(track_data: dict[str, Any]) -> str:
    with SessionLocal() as session:
        track = session.merge(TrackSummary(**track_data))
        session.commit()
        session.refresh(track)
        return str(track.id)
