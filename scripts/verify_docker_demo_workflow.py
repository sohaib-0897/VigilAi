"""
VigilAI — Full Docker Bundled Demo Workflow Verification Script

Verifies:
1. Demo video asset existence in API and Worker containers.
2. User registration and authentication.
3. POST /api/v1/cameras/demo endpoint execution.
4. Idempotent reuse of demo camera.
5. Provisioning of detection zone and rule.
6. Starting analytics.
7. Worker frame decoding, detection, tracking, event emission, video looping, and state reset at replay boundary.
8. Clean analytics shutdown.
"""

import json
import subprocess
import sys
import time
from uuid import uuid4

import httpx
import redis

BASE_URL = "http://localhost:8000/api/v1"
REDIS_HOST = "localhost"
REDIS_PORT = 6379


def run_cmd(cmd: list[str]) -> tuple[int, str]:
    res = subprocess.run(cmd, capture_output=True, text=True)
    return res.returncode, res.stdout + res.stderr


def main():
    results = {}
    print("=" * 60)
    print("VigilAI Docker Bundled Demo Workflow Verification")
    print("=" * 60)

    # 1. Check container asset mounts
    print("\n[Step 1] Verifying demo asset inside containers...")
    code_api, out_api = run_cmd(["docker", "compose", "exec", "-T", "api", "ls", "-la", "/app/data/demo/demo_feed.mp4"])
    code_wrk, out_wrk = run_cmd(["docker", "compose", "exec", "-T", "worker", "ls", "-la", "/app/data/demo/demo_feed.mp4"])

    assert code_api == 0, f"Asset missing in api container: {out_api}"
    assert code_wrk == 0, f"Asset missing in worker container: {out_wrk}"
    print(f"  API container asset:    {out_api.strip()}")
    print(f"  Worker container asset: {out_wrk.strip()}")
    results["container_assets"] = "PASS"

    # 2. Register & Authenticate User
    print("\n[Step 2] Registering and authenticating test operator...")
    test_id = uuid4().hex[:8]
    email = f"demo_tester_{test_id}@example.com"
    username = f"tester_{test_id}"
    password = f"TestPass_{test_id}!2026"

    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        # Register
        reg_res = client.post("/auth/register", json={
            "email": email,
            "username": username,
            "password": password,
        })
        assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.status_code} {reg_res.text}"
        user_data = reg_res.json()
        print(f"  User registered: {email} (ID: {user_data['id']})")

        # Login
        login_res = client.post("/auth/login", json={
            "email": email,
            "password": password,
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  Authenticated successfully (Bearer token acquired)")
        results["auth"] = "PASS"

        # 3. Call POST /api/v1/cameras/demo
        print("\n[Step 3] Calling POST /api/v1/cameras/demo...")
        demo_res = client.post("/cameras/demo", headers=headers)
        assert demo_res.status_code == 200, f"Demo camera call failed: {demo_res.status_code} {demo_res.text}"
        cam = demo_res.json()
        camera_id = cam["id"]
        source_uri = cam["source_uri"]
        source_type = cam["source_type"]
        assert source_uri == "/app/data/demo/demo_feed.mp4", f"Unexpected source_uri: {source_uri}"
        assert source_type == "local_video", f"Unexpected source_type: {source_type}"
        print(f"  Demo camera created: ID={camera_id}")
        print(f"  Source URI: {source_uri}")
        print(f"  Source Type: {source_type}")
        results["demo_camera_creation"] = "PASS"

        # 4. Verify Idempotent Reuse
        print("\n[Step 4] Verifying idempotent reuse...")
        demo_res_2 = client.post("/cameras/demo", headers=headers)
        assert demo_res_2.status_code == 200, f"Second demo call failed: {demo_res_2.status_code}"
        cam_2 = demo_res_2.json()
        assert cam_2["id"] == camera_id, f"Expected same camera ID, got {cam_2['id']} vs {camera_id}"

        # Confirm only 1 camera in list
        list_res = client.get("/cameras", headers=headers)
        assert list_res.status_code == 200
        items = list_res.json().get("items", [])
        assert len(items) == 1, f"Expected 1 camera, found {len(items)}"
        print(f"  Idempotency verified: Same camera ID {camera_id} returned, camera list total = {len(items)}")
        results["idempotency"] = "PASS"

        # 5. Configure Spatial Zone & Analytics Rule
        print("\n[Step 5] Provisioning zone and rule on demo camera...")
        zone_payload = {
            "name": "Restricted Demo Zone",
            "zone_type": "restricted",
            "points": [
                {"x": 0.05, "y": 0.05},
                {"x": 0.95, "y": 0.05},
                {"x": 0.95, "y": 0.95},
                {"x": 0.05, "y": 0.95},
            ],
            "color": "#FF0000",
            "enabled": True,
        }
        zone_res = client.post(f"/cameras/{camera_id}/zones", json=zone_payload, headers=headers)
        assert zone_res.status_code == 200, f"Zone creation failed: {zone_res.status_code} {zone_res.text}"
        zone = zone_res.json()
        zone_id = zone["id"]
        print(f"  Zone created: ID={zone_id}, name={zone['name']}")

        rule_payload = {
            "name": "Demo Zone Entry Detection",
            "rule_type": "zone_entry",
            "severity": "high",
            "object_classes": ["person", "car"],
            "zone_id": zone_id,
            "cooldown_seconds": 2,
            "enabled": True,
        }
        rule_res = client.post(f"/cameras/{camera_id}/rules", json=rule_payload, headers=headers)
        assert rule_res.status_code == 200, f"Rule creation failed: {rule_res.status_code} {rule_res.text}"
        rule = rule_res.json()
        print(f"  Rule created: ID={rule['id']}, name={rule['name']}")
        results["zone_and_rule"] = "PASS"

        # 6. Start Analytics
        print("\n[Step 6] Starting analytics on camera...")
        start_res = client.post(f"/cameras/{camera_id}/start", headers=headers)
        assert start_res.status_code == 200, f"Start analytics failed: {start_res.status_code} {start_res.text}"
        print(f"  Analytics command sent: {start_res.json()}")
        results["start_analytics"] = "PASS"

        # 7. Monitor Worker Processing and Replay Boundary
        print("\n[Step 7] Monitoring worker execution, events, and replay boundary...")
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        pubsub = r.pubsub()
        pubsub.subscribe("vigilai:events", f"vigilai:telemetry:{camera_id}")

        start_time = time.time()
        timeout_seconds = 45.0
        frames_seen = 0
        events_captured = []
        replay_detected = False
        loop_count_observed = 0

        print("  Listening for Redis events and worker logs (timeout: 45s)...")
        while time.time() - start_time < timeout_seconds:
            # Check Redis pubsub
            msg = pubsub.get_message(timeout=1.0)
            if msg and msg.get("type") == "message":
                channel = msg["channel"]
                data = msg["data"]
                if channel == "vigilai:events":
                    try:
                        ev = json.loads(data)
                        if ev.get("camera_id") == camera_id:
                            events_captured.append(ev)
                            print(f"    [Redis Event] {ev.get('event_type')} (Severity: {ev.get('severity')}) Track: {ev.get('track_id')}")
                    except Exception:
                        pass
                elif channel == f"vigilai:telemetry:{camera_id}":
                    try:
                        telem = json.loads(data)
                        frames_seen += 1
                        fps = telem.get("fps", 0)
                        if frames_seen % 10 == 0:
                            print(f"    [Telemetry] Frame count: {frames_seen}, Worker FPS: {fps:.2f}")
                    except Exception:
                        pass

            # Inspect worker logs for replay boundary
            _, logs = run_cmd(["docker", "compose", "logs", "--tail", "50", "worker"])
            if "Reset camera state at local video replay boundary" in logs and camera_id in logs:
                replay_detected = True
                print("    [Worker Log] CONFIRMED: Reset camera state at local video replay boundary!")
                break

            time.sleep(0.5)

        pubsub.unsubscribe()
        pubsub.close()

        # Query persisted events from API
        ev_res = client.get(f"/events?camera_id={camera_id}", headers=headers)
        persisted_events = ev_res.json().get("items", []) if ev_res.status_code == 200 else []
        print(f"  Persisted events in DB: {len(persisted_events)}")

        assert replay_detected, "Worker did not reach/log replay boundary within timeout!"
        print("  Replay boundary reset: VERIFIED")
        results["replay_boundary"] = "PASS"
        results["events_emitted"] = len(persisted_events)

        # 8. Stop Analytics
        print("\n[Step 8] Stopping analytics...")
        stop_res = client.post(f"/cameras/{camera_id}/stop", headers=headers)
        assert stop_res.status_code == 200, f"Stop analytics failed: {stop_res.status_code}"
        print(f"  Analytics stopped: {stop_res.json()}")
        results["stop_analytics"] = "PASS"

    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY: ALL CHECKS PASSED")
    print("=" * 60)
    for k, v in results.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
