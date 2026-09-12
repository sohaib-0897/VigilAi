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
