"""Tests the actual application; no substitute routes."""

from datetime import UTC

import pytest
from fastapi.testclient import TestClient
from vigilai_api.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
    verify_token,
)
from vigilai_api.main import app


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/auth/me",
        "/api/v1/cameras",
        "/api/v1/events",
        "/api/v1/events/export",
        "/api/v1/analytics/overview",
        "/api/v1/analytics/timeseries",
        "/api/v1/analytics/distribution",
        "/api/v1/system/metrics",
        "/api/v1/cameras/00000000-0000-0000-0000-000000000001/stream",
    ],

)
def test_private_routes_require_authentication(path):
    with TestClient(app, raise_server_exceptions=True) as client:
        assert client.get(path).status_code == 401


def test_password_and_token_verification():
    hashed = get_password_hash("a-test-password")
    assert verify_password("a-test-password", hashed)
    assert not verify_password("wrong", hashed)
    token = create_access_token("00000000-0000-0000-0000-000000000001")
    assert verify_token(token)
    assert verify_token(token, "refresh") is None
    assert verify_token("invalid") is None


def test_socket_requires_authentication():
    from starlette.websockets import WebSocketDisconnect

    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/api/v1/ws/events"):
        pass


def test_camera_serialization_redacts_credentials():
    from datetime import datetime
    from uuid import uuid4

    from vigilai_api.schemas.camera import CameraResponse

    camera = CameraResponse(
        id=uuid4(),
        user_id=uuid4(),
        name="camera",
        source_type="rtsp",
        source_uri="rtsp://admin:secret@host/live",
        analytics_enabled=False,
        status="offline",
        status_message=None,
        width=None,
        height=None,
        fps=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    assert "secret" not in camera.model_dump_json()


def test_video_upload_requires_authentication():
    with TestClient(app, raise_server_exceptions=True) as client:
        res = client.post(
            "/api/v1/cameras/00000000-0000-0000-0000-000000000001/upload",
            files={"file": ("test.mp4", b"fake video content", "video/mp4")},
        )
        assert res.status_code == 401


def test_video_upload_rejects_invalid_extension():
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from vigilai_api.core.deps import get_current_user, get_db
    from vigilai_api.db.models.camera import Camera
    from vigilai_api.db.models.user import User

    fake_user = User(id=uuid4(), email="test@example.com", username="testuser", is_active=True)
    fake_camera = Camera(id=uuid4(), user_id=fake_user.id, name="cam1", source_type="local_video")

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: AsyncMock()

    try:
        with (
            patch("vigilai_api.services.camera.CameraService.get_camera", return_value=fake_camera),
            TestClient(app) as client,
        ):
            res = client.post(
                f"/api/v1/cameras/{fake_camera.id}/upload",
                files={"file": ("script.exe", b"malicious binary", "application/x-msdownload")},
            )
            assert res.status_code == 400
            assert "Invalid file extension" in res.json().get("detail", "")
    finally:
        app.dependency_overrides.clear()
