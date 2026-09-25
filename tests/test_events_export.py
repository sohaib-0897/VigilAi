import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from vigilai_api.core.deps import get_current_user, get_db
from vigilai_api.db.models.analytics_rule import Severity
from vigilai_api.db.models.event import Event, EventStatus
from vigilai_api.db.models.user import User
from vigilai_api.main import app


def test_events_export_unauthenticated():
    with TestClient(app) as client:
        res = client.get("/api/v1/events/export?format=csv")
        assert res.status_code == 401


def test_events_export_csv_authenticated():
    fake_user = User(id=uuid4(), email="analyst@example.com", username="analyst", is_active=True)
    fake_event = Event(
        id=uuid4(),
        camera_id=uuid4(),
        rule_id=uuid4(),
        event_type="zone_entry",
        severity=Severity.critical,
        object_class="person",
        track_id=42,
        started_at=datetime.now(UTC),
        ended_at=datetime.now(UTC),
        status=EventStatus.active,
        fingerprint="cam:rule:42:trig",
        metadata_={"zone_name": "Vault"},
    )

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: AsyncMock()

    try:
        with (
            patch("vigilai_api.services.event.EventService.list_events", return_value=([fake_event], 1)),
            TestClient(app) as client,
        ):
            res = client.get("/api/v1/events/export?format=csv")
            assert res.status_code == 200
            assert "text/csv" in res.headers["content-type"]
            assert "attachment; filename=vigilai_events_export.csv" in res.headers["content-disposition"]
            content = res.text
            assert "Event ID,Started At,Ended At,Camera ID,Event Type,Severity,Object Class,Track ID,Status,Fingerprint" in content
            assert str(fake_event.id) in content
            assert "zone_entry" in content
            assert "critical" in content
            assert "person" in content
            assert "42" in content
    finally:
        app.dependency_overrides.clear()


def test_events_export_json_authenticated():
    fake_user = User(id=uuid4(), email="analyst@example.com", username="analyst", is_active=True)
    fake_event = Event(
        id=uuid4(),
        camera_id=uuid4(),
        rule_id=uuid4(),
        event_type="line_crossing",
        severity=Severity.high,
        object_class="car",
        track_id=10,
        started_at=datetime.now(UTC),
        ended_at=None,
        status=EventStatus.active,
        fingerprint="cam:rule:10:trig",
        metadata_={"line_name": "Perimeter Gate"},
    )

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: AsyncMock()

    try:
        with (
            patch("vigilai_api.services.event.EventService.list_events", return_value=([fake_event], 1)),
            TestClient(app) as client,
        ):
            res = client.get("/api/v1/events/export?format=json")
            assert res.status_code == 200
            assert "application/json" in res.headers["content-type"]
            assert "attachment; filename=vigilai_events_export.json" in res.headers["content-disposition"]
            data = res.json()
            assert isinstance(data, list)
            assert len(data) == 1
            item = data[0]
            assert item["id"] == str(fake_event.id)
            assert item["event_type"] == "line_crossing"
            assert item["severity"] == "high"
            assert item["object_class"] == "car"
            assert item["track_id"] == 10
    finally:
        app.dependency_overrides.clear()


def test_events_primary_evidence_endpoint_404_when_no_evidence():
    fake_user = User(id=uuid4(), email="analyst@example.com", username="analyst", is_active=True)
    fake_event = Event(
        id=uuid4(),
        camera_id=uuid4(),
        rule_id=uuid4(),
        event_type="zone_entry",
        severity=Severity.low,
        object_class="person",
        track_id=1,
        started_at=datetime.now(UTC),
        ended_at=None,
        status=EventStatus.active,
        fingerprint="cam:rule:1:trig",
        metadata_={},
    )
    fake_event.evidences = []

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: AsyncMock()

    try:
        with (
            patch("vigilai_api.services.event.EventService.get_event", return_value=fake_event),
            TestClient(app) as client,
        ):
            res = client.get(f"/api/v1/events/{fake_event.id}/evidence")
            assert res.status_code == 404
            assert res.json()["detail"] == "No evidence for event"
    finally:
        app.dependency_overrides.clear()

