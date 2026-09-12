"""Real PostgreSQL/API/YOLO smoke. Run only against a disposable demo database.

Creates uniquely named users and cameras, and deletes those records at completion.
Model weights and generated test media live under ignored .verification/.
"""

import json
import time
import uuid
from pathlib import Path

import cv2
import redis
from fastapi.testclient import TestClient
from vigilai_api.cv.detection.yolo import YOLODetector
from vigilai_api.cv.tracking.byte_tracker import ByteTrackTracker
from vigilai_api.db.models import User
from vigilai_api.main import app

from apps.worker import db as worker_db
from apps.worker.pipeline import CameraPipeline

root = Path(".verification").resolve()
root.mkdir(exist_ok=True)
result = {}
created_users = []


def check(response, status=200):
    assert response.status_code == status, (response.status_code, response.text[:1200])
    return response.json()


with TestClient(app) as client:
    try:
        suffix = uuid.uuid4().hex[:10]
        for who in ("owner", "other"):
            user = check(
                client.post(
                    "/api/v1/auth/register",
                    json={
                        "email": f"{who}{suffix}@example.com",
                        "username": f"{who}{suffix}",
                        "password": "Smoke-test-password-123",
                    },
                )
            )
            created_users.append(user["id"])
        check(
            client.post(
                "/api/v1/auth/login",
                json={"email": f"owner{suffix}@example.com", "password": "Smoke-test-password-123"},
            )
        )
        owner_cookies = dict(client.cookies)
        assert check(client.get("/api/v1/auth/me"))["id"] == created_users[0]
        check(client.post("/api/v1/auth/refresh"))
        camera = check(
            client.post(
                "/api/v1/cameras",
                json={
                    "name": "Verification video",
                    "source_type": "local_video",
                    "source_uri": "",
                    "enabled": True,
                },
            )
        )
        cid = camera["id"]
        check(client.get("/api/v1/cameras"))
        zone = check(
            client.post(
                f"/api/v1/cameras/{cid}/zones",
                json={
                    "name": "Entire scene",
                    "zone_type": "custom",
                    "points": [
                        {"x": 0.01, "y": 0.01},
                        {"x": 0.99, "y": 0.01},
                        {"x": 0.99, "y": 0.99},
                        {"x": 0.01, "y": 0.99},
                    ],
                },
            )
        )
        line = check(
            client.post(
                f"/api/v1/cameras/{cid}/lines",
                json={
                    "name": "Midline",
                    "start_point": {"x": 0.5, "y": 0},
                    "end_point": {"x": 0.5, "y": 1},
                    "direction_mode": "both",
                },
            )
        )
        for kind, threshold in [
            ("zone_entry", None),
            ("dwell_time", 0.1),
            ("occupancy_threshold", 1),
        ]:
            check(
                client.post(
                    f"/api/v1/cameras/{cid}/rules",
                    json={
                        "name": kind,
                        "rule_type": kind,
                        "severity": "high",
                        "zone_id": zone["id"],
                        "threshold_value": threshold,
                        "cooldown_seconds": 30,
                    },
                )
            )
        check(
            client.post(
                f"/api/v1/cameras/{cid}/rules",
                json={"name": "invalid", "rule_type": "dwell_time", "severity": "high"},
            ),
            400,
        )
        check(
            client.post(
                f"/api/v1/cameras/{cid}/zones",
                json={"name": "invalid", "zone_type": "custom", "points": [{"x": 0, "y": 0}] * 3},
            ),
            400,
        )
        check(
            client.post(
                f"/api/v1/cameras/{cid}/upload",
                files={"file": ("corrupt.mp4", b"not a video", "video/mp4")},
            ),
            400,
        )
        result["api_crud_validation"] = "PASS"

        import ultralytics

        source_image = Path(ultralytics.__file__).parent / "assets" / "bus.jpg"
        frame = cv2.imread(str(source_image))
        assert frame is not None, "Ultralytics bus image unavailable"
        frame = cv2.resize(frame, (432, 576))
        video = root / "real-scene.avi"
        writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"MJPG"), 8, (432, 576))
        assert writer.isOpened()
        for _ in range(40):
            writer.write(frame)
        writer.release()
        with video.open("rb") as f:
            check(
                client.post(
                    f"/api/v1/cameras/{cid}/upload",
                    files={"file": ("scene.avi", f, "video/x-msvideo")},
                )
            )
        detector = YOLODetector(str(root / "yolov8n.pt"))
        detector.configure(0.25, 0.45, [0, 1, 2, 3, 5, 7], 640)
        detection = detector.detect(frame)
        assert any(d.class_name == "person" for d in detection.detections)
        result["real_yolo_detections"] = len(detection.detections)
        raw_redis = redis.from_url("redis://localhost:6379/0")
        pipeline = CameraPipeline(
            cid,
            worker_db.load_camera(cid),
            detector,
            ByteTrackTracker,
            raw_redis,
            str(Path("evidence").resolve()),
            frame_queue_size=2,
        )
        pipeline.start()
        deadline = time.monotonic() + 45
        while pipeline.is_running and time.monotonic() < deadline:
            time.sleep(0.25)
        assert not pipeline.is_running, "Pipeline did not finish at EOF"
        assert pipeline.stats.frames_processed > 0
        assert pipeline.stats.pipeline_errors == 0, pipeline.stats.to_dict()
        event_data = check(client.get("/api/v1/events", params={"camera_id": cid}))
        assert event_data["total"] >= 3, event_data
        events = event_data["items"]
        assert any(e["event_type"] == "dwell_time" for e in events)
        entries = [e for e in events if e["event_type"] == "zone_entry"]
        assert len(entries) == len({e["track_id"] for e in entries}), "Duplicate entry events"
        event = check(client.get("/api/v1/events/" + entries[0]["id"]))
        assert event["evidences"], event
        evidence_url = f"/api/v1/events/{event['id']}/evidence/{event['evidences'][0]['id']}/file"
        evidence = client.get(evidence_url)
        assert evidence.status_code == 200 and evidence.headers["content-type"].startswith(
            "image/jpeg"
        )
        check(
            client.patch(
                "/api/v1/events/" + event["id"] + "/status", json={"status": "acknowledged"}
            )
        )
        check(client.get("/api/v1/analytics/overview"))
        assert check(client.get("/api/v1/analytics/distribution"))
        assert check(client.get("/api/v1/analytics/timeseries"))
        result["pipeline"] = pipeline.stats.to_dict()
        result["persisted_events"] = event_data["total"]
        result["evidence_and_analytics"] = "PASS"

        with client.websocket_connect("/api/v1/ws/events") as ws:
            deadline = time.monotonic() + 5
            while (
                raw_redis.pubsub_numsub("vigilai:events")[0][1] == 0 and time.monotonic() < deadline
            ):
                time.sleep(0.05)
            raw_redis.publish(
                "vigilai:events", json.dumps({"camera_id": cid, "event_id": event["id"]})
            )
            assert ws.receive_json()["event_id"] == event["id"]
        result["authenticated_websocket"] = "PASS"
        check(
            client.post(
                "/api/v1/auth/login",
                json={"email": f"other{suffix}@example.com", "password": "Smoke-test-password-123"},
            )
        )
        for path in [
            f"/api/v1/cameras/{cid}",
            f"/api/v1/cameras/{cid}/zones",
            f"/api/v1/cameras/{cid}/stream",
            "/api/v1/events/" + event["id"],
            evidence_url,
        ]:
            check(client.get(path), 404)
        assert check(client.get("/api/v1/events"))["total"] == 0
        assert check(client.get("/api/v1/analytics/distribution")) == {}
        result["cross_user_isolation"] = "PASS"
        check(client.post("/api/v1/auth/logout"))
        check(client.get("/api/v1/auth/me"), 401)
        pipeline.stop()
        raw_redis.close()
    finally:
        with worker_db.SessionLocal() as session:
            for uid in created_users:
                user = session.get(User, uuid.UUID(uid))
                if user:
                    session.delete(user)
            session.commit()

(root / "runtime-results.json").write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
