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


def test_demo_camera_creation_uses_server_path_and_normal_camera_response(tmp_path):
    from datetime import datetime
    from unittest.mock import AsyncMock, patch
    from uuid import uuid4

    from vigilai_api.core.config import get_settings
    from vigilai_api.core.deps import get_db, require_auth
    from vigilai_api.db.models.camera import Camera, CameraStatus, SourceType
    from vigilai_api.db.models.user import User

    demo_path = tmp_path / "demo_feed.mp4"
    demo_path.write_bytes(b"video")
    user_id = uuid4()
    now = datetime.now(UTC)
    user = User(id=user_id, email="demo@example.com", username="demo", is_active=True)
    camera = Camera(
        id=uuid4(), user_id=user_id, name="VigilAI Demo — Surveillance Feed",
        description="Bundled local video processed through the standard VigilAI pipeline.",
        source_type=SourceType.local_video, source_uri=str(demo_path.resolve()),
        model_id="coco-yolov8n-onnx", enabled=True, analytics_enabled=False,
        status=CameraStatus.offline, created_at=now, updated_at=now,
    )
    app.dependency_overrides[require_auth] = lambda: user
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    original_path = get_settings().DEMO_VIDEO_PATH
    get_settings().DEMO_VIDEO_PATH = str(demo_path)
    try:
        with patch(
            "vigilai_api.services.camera.CameraService.get_or_create_demo_camera",
            new=AsyncMock(return_value=camera),
        ) as create_demo, TestClient(app) as client:
            # A malicious body cannot select a different filesystem path.
            response = client.post("/api/v1/cameras/demo", json={"source_uri": "../../secret.txt"})
        assert response.status_code == 200
        payload = response.json()
        assert payload["source_uri"] == str(demo_path.resolve())
        assert payload["source_type"] == "local_video"
        assert payload["user_id"] == str(user_id)
        assert payload["name"] == "VigilAI Demo — Surveillance Feed"
        create_demo.assert_awaited_once_with(user_id, str(demo_path.resolve()))
    finally:
        get_settings().DEMO_VIDEO_PATH = original_path
        app.dependency_overrides.clear()


def test_demo_camera_creation_requires_authentication():
    with TestClient(app, raise_server_exceptions=True) as client:
        assert client.post("/api/v1/cameras/demo").status_code == 401


def test_demo_camera_missing_asset_returns_useful_error(tmp_path):
    from unittest.mock import AsyncMock

    from vigilai_api.core.config import get_settings
    from vigilai_api.core.deps import get_db, require_auth
    from vigilai_api.db.models.user import User
    from uuid import uuid4

    app.dependency_overrides[require_auth] = lambda: User(
        id=uuid4(), email="demo@example.com", username="demo", is_active=True
    )
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    original_path = get_settings().DEMO_VIDEO_PATH
    get_settings().DEMO_VIDEO_PATH = str(tmp_path / "missing.mp4")
    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/cameras/demo")
        assert response.status_code == 503
        assert "Bundled demo video is unavailable" in response.json()["detail"]
    finally:
        get_settings().DEMO_VIDEO_PATH = original_path
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_demo_camera_creation_is_idempotent_for_owned_camera():
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from vigilai_api.services.camera import CameraService

    existing = object()
    user_id = uuid4()
    demo_path = "/app/data/demo/demo_feed.mp4"
    service = CameraService.__new__(CameraService)
    service.repo = AsyncMock()
    service.repo.get_demo_camera.return_value = existing

    result = await service.get_or_create_demo_camera(user_id, demo_path)

    assert result is existing
    service.repo.get_demo_camera.assert_awaited_once_with(user_id, demo_path)
    service.repo.create.assert_not_awaited()


@pytest.mark.asyncio
async def test_demo_camera_creation_uses_default_surveillance_configuration():
    from unittest.mock import AsyncMock
    from uuid import uuid4

    from vigilai_api.services.camera import CameraService

    user_id = uuid4()
    demo_path = "/app/data/demo/demo_feed.mp4"
    service = CameraService.__new__(CameraService)
    service.repo = AsyncMock()
    service.repo.get_demo_camera.return_value = None
    camera = object()
    service.repo.create.return_value = camera

    result = await service.get_or_create_demo_camera(user_id, demo_path)

    assert result is camera
    service.repo.create.assert_awaited_once_with(
        user_id,
        name="VigilAI Demo — Surveillance Feed",
        description="Bundled local video processed through the standard VigilAI pipeline.",
        source_type="local_video",
        source_uri=demo_path,
        model_id="coco-yolov8n-onnx",
        enabled=True,
        analytics_enabled=False,
    )


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


def test_query_param_access_tokens_are_strictly_prohibited():
    """Security test: access tokens in URL query params must be rejected on standard endpoints."""
    from datetime import UTC, datetime
    from unittest.mock import AsyncMock, MagicMock
    from uuid import uuid4

    from vigilai_api.core.security import create_access_token
    from vigilai_api.db.models.user import User

    user_id = uuid4()
    now = datetime.now(UTC)
    fake_user = User(
        id=user_id,
        email="tokenparam@example.com",
        username="tokenparam",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    valid_token = create_access_token(str(user_id))

    mock_session = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = fake_user
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    from vigilai_api.core.deps import get_db

    app.dependency_overrides[get_db] = lambda: mock_session

    try:
        with TestClient(app) as client:
            res = client.get(f"/api/v1/auth/me?token={valid_token}")
            assert res.status_code == 401
            assert "prohibited in URL query parameters" in res.json().get("detail", "")
    finally:
        app.dependency_overrides.clear()


def test_stream_ticket_lifecycle_and_security():
    """Security test: stream tickets must allow stream access when valid, but enforce expiry and camera-binding."""
    from datetime import UTC, datetime
    from unittest.mock import AsyncMock, MagicMock, patch
    from uuid import uuid4

    from vigilai_api.core.deps import get_current_user, get_db
    from vigilai_api.core.security import (
        create_access_token,
        create_stream_ticket,
        verify_stream_ticket,
    )
    from vigilai_api.db.models.camera import Camera
    from vigilai_api.db.models.user import User

    user_id = uuid4()
    cam_a_id = uuid4()
    cam_b_id = uuid4()

    fake_user = User(
        id=user_id,
        email="streamuser@example.com",
        username="streamuser",
        is_active=True,
    )
    fake_cam_a = Camera(id=cam_a_id, user_id=user_id, name="Camera A", source_type="local_video")

    mock_session = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = fake_user
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    mock_session.execute.return_value = mock_result

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: mock_session

    async def mock_frame_gen(cam_id, req=None):
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\nfake-jpeg\r\n"

    try:
        with (
            patch("vigilai_api.services.camera.CameraService.get_camera", return_value=fake_cam_a),
            patch("vigilai_api.api.v1.streaming.frame_generator", side_effect=mock_frame_gen),
            TestClient(app) as client,
        ):
            # 1. Issue stream ticket for Camera A
            res = client.post(f"/api/v1/cameras/{cam_a_id}/stream-ticket")
            assert res.status_code == 200
            data = res.json()
            assert "ticket" in data
            assert data["camera_id"] == str(cam_a_id)
            ticket = data["ticket"]

            # 2. Access Camera A stream with valid ticket (unauthenticated client context)
            app.dependency_overrides.pop(get_current_user, None)
            stream_res = client.get(f"/api/v1/cameras/{cam_a_id}/stream?ticket={ticket}")
            assert stream_res.status_code == 200

            # 3. Attempt to use Camera A ticket on Camera B (Cross-camera ticket tampering)
            cross_cam_res = client.get(f"/api/v1/cameras/{cam_b_id}/stream?ticket={ticket}")
            assert cross_cam_res.status_code == 401
            assert "mismatched stream ticket" in cross_cam_res.json().get("detail", "")

            # 4. Attempt to access stream with expired ticket
            expired_ticket = create_stream_ticket(str(user_id), str(cam_a_id), expires_seconds=-10)
            expired_res = client.get(f"/api/v1/cameras/{cam_a_id}/stream?ticket={expired_ticket}")
            assert expired_res.status_code == 401

            # 5. Attempt to access stream with tampered ticket
            tampered_res = client.get(f"/api/v1/cameras/{cam_a_id}/stream?ticket={ticket}tampered")
            assert tampered_res.status_code == 401

            # 6. Attempt to use long-lived access token in query param (?token=) on stream
            access_token = create_access_token(str(user_id))
            token_query_res = client.get(f"/api/v1/cameras/{cam_a_id}/stream?token={access_token}")
            assert token_query_res.status_code == 401
            assert "prohibited in URL query parameters" in token_query_res.json().get("detail", "")
    finally:
        app.dependency_overrides.clear()
