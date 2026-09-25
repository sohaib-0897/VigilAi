"""
VigilAI — Turnkey Evaluator Demo Setup Script

Provisions a complete, out-of-the-box working environment:
1. Operator user: admin@vigilai.local / vigilai_dev_2024
2. Realistic surveillance test video: assets/demo/demo_feed.mp4 (bundled and preserved)
3. Camera surveillance node: 'Main Entrance & Loading Dock'
4. Configured spatial zones: 'Restricted Loading Bay' and 'Pedestrian Walkway'
5. Configured virtual tripwire: 'Entry Gate Tripwire'
6. Configured analytics rules: zone entry, tripwire crossing, dwell time, and occupancy threshold

Usage:
    python scripts/demo_setup.py
"""

import asyncio
import logging
import os
import sys
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np
from sqlalchemy import select

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "api"))

from vigilai_api.core.security import get_password_hash
from vigilai_api.db.models.analytics_rule import AnalyticsRule, RuleType, Severity
from vigilai_api.db.models.camera import Camera, CameraStatus, SourceType
from vigilai_api.db.models.user import User
from vigilai_api.db.models.virtual_line import DirectionMode, VirtualLine
from vigilai_api.db.models.zone import Zone, ZoneType
from vigilai_api.db.session import async_session_maker

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("demo_setup")

DEV_EMAIL = "admin@vigilai.local"
DEV_USERNAME = "admin"
DEV_PASSWORD = "vigilai_dev_2024"
DEMO_VIDEO_REL_PATH = "assets/demo/demo_feed.mp4"


def generate_synthetic_surveillance_video(output_path: Path, num_frames: int = 150) -> Path:
    """Generate a synthetic CCTV surveillance video with simulated people and vehicles."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and output_path.stat().st_size > 1000:
        logger.info(f"Using existing synthetic demo footage at {output_path}")
        return output_path

    logger.info(f"Generating synthetic surveillance footage: {output_path} ({num_frames} frames)...")
    width, height = 640, 360
    fps = 25.0
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    try:
        for f in range(num_frames):
            # 1. Dark industrial background with asphalt roadway
            frame = np.full((height, width, 3), (35, 38, 42), dtype=np.uint8)

            # Draw roadway lanes
            cv2.rectangle(frame, (0, int(height * 0.45)), (width, int(height * 0.55)), (55, 58, 62), -1)
            # Dashed lane divider
            for x in range(0, width, 40):
                cv2.line(frame, (x, int(height * 0.50)), (x + 20, int(height * 0.50)), (200, 200, 200), 2)

            # Draw loading dock area marker
            cv2.rectangle(
                frame,
                (int(width * 0.15), int(height * 0.25)),
                (int(width * 0.55), int(height * 0.85)),
                (60, 40, 40),
                1,
            )
            cv2.putText(
                frame,
                "RESTRICTED BAY",
                (int(width * 0.16), int(height * 0.28)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (100, 100, 180),
                1,
            )

            # 2. Simulated Person 1: walks from left (0.05) into the restricted bay (0.35)
            progress = min(1.0, f / 100.0)
            person_x = int(width * (0.05 + progress * 0.30))
            person_y = int(height * (0.30 + progress * 0.15))
            # Draw person (head + torso + legs)
            cv2.circle(frame, (person_x, person_y - 20), 8, (210, 180, 140), -1)
            cv2.rectangle(frame, (person_x - 7, person_y - 12), (person_x + 7, person_y + 15), (40, 40, 180), -1)
            cv2.line(frame, (person_x - 4, person_y + 15), (person_x - 4, person_y + 30), (20, 20, 20), 3)
            cv2.line(frame, (person_x + 4, person_y + 15), (person_x + 4, person_y + 30), (20, 20, 20), 3)

            # 3. Simulated Vehicle 1: drives along roadway from left to right crossing tripwire at 0.50
            if f >= 20:
                car_progress = (f - 20) / 80.0
                car_x = int(width * (-0.1 + car_progress * 1.2))
                car_y = int(height * 0.48)
                # Draw car body
                cv2.rectangle(frame, (car_x - 35, car_y - 15), (car_x + 35, car_y + 12), (180, 80, 40), -1)
                # Car roof/cabin
                cv2.rectangle(frame, (car_x - 18, car_y - 25), (car_x + 18, car_y - 15), (140, 60, 30), -1)
                # Wheels
                cv2.circle(frame, (car_x - 22, car_y + 12), 6, (10, 10, 10), -1)
                cv2.circle(frame, (car_x + 22, car_y + 12), 6, (10, 10, 10), -1)

            # HUD timestamp overlay
            cv2.putText(
                frame,
                f"CCTV-01 CAM REC [FRAME {f:03d}/{num_frames}]",
                (12, 22),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 255, 0),
                1,
            )

            out.write(frame)
    finally:
        out.release()

    logger.info(f"Synthetic demo footage created successfully at {output_path}")
    return output_path


async def setup_demo_environment() -> dict:
    """Provision demo user, camera, zones, virtual lines, and rules idempotently."""
    video_path = PROJECT_ROOT / DEMO_VIDEO_REL_PATH
    generate_synthetic_surveillance_video(video_path)

    async with async_session_maker() as session:
        # 1. User
        res = await session.execute(select(User).where(User.email == DEV_EMAIL))
        user = res.scalars().first()
        if not user:
            user = User(
                id=uuid4(),
                email=DEV_EMAIL,
                username=DEV_USERNAME,
                hashed_password=get_password_hash(DEV_PASSWORD),
                is_active=True,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            logger.info(f"Created demo operator: {DEV_EMAIL}")
        else:
            logger.info(f"Using existing demo operator: {DEV_EMAIL}")

        # 2. Camera
        cam_res = await session.execute(
            select(Camera).where(Camera.user_id == user.id, Camera.name == "Main Entrance & Loading Dock")
        )
        camera = cam_res.scalars().first()
        if not camera:
            camera = Camera(
                id=uuid4(),
                user_id=user.id,
                name="Main Entrance & Loading Dock",
                description="Turnkey demo CCTV node for restricted bay intrusion, vehicle tripwire, and dwell analytics.",
                source_type=SourceType.local_video,
                source_uri=str(video_path),
                enabled=True,
                analytics_enabled=False,
                status=CameraStatus.offline,
                width=640,
                height=360,
                fps=25,
            )
            session.add(camera)
            await session.commit()
            await session.refresh(camera)
            logger.info(f"Provisioned demo camera: {camera.name} ({camera.id})")
        else:
            camera.source_uri = str(video_path)
            await session.commit()
            logger.info(f"Using existing demo camera: {camera.name} ({camera.id})")

        # 3. Zones
        zones_to_create = [
            {
                "name": "Restricted Loading Bay",
                "zone_type": ZoneType.restricted,
                "points": [
                    {"x": 0.15, "y": 0.25},
                    {"x": 0.55, "y": 0.25},
                    {"x": 0.55, "y": 0.85},
                    {"x": 0.15, "y": 0.85},
                ],
                "color": "#FF5C5C",
            },
            {
                "name": "Pedestrian Walkway",
                "zone_type": ZoneType.pedestrian,
                "points": [
                    {"x": 0.60, "y": 0.20},
                    {"x": 0.90, "y": 0.20},
                    {"x": 0.90, "y": 0.80},
                    {"x": 0.60, "y": 0.80},
                ],
                "color": "#FFD93D",
            },
        ]

        active_zones = {}
        for z_spec in zones_to_create:
            z_res = await session.execute(
                select(Zone).where(Zone.camera_id == camera.id, Zone.name == z_spec["name"])
            )
            zone = z_res.scalars().first()
            if not zone:
                zone = Zone(
                    id=uuid4(),
                    camera_id=camera.id,
                    name=z_spec["name"],
                    zone_type=z_spec["zone_type"],
                    points=z_spec["points"],
                    color=z_spec["color"],
                    enabled=True,
                )
                session.add(zone)
                await session.commit()
                await session.refresh(zone)
                logger.info(f"Created zone: {zone.name}")
            active_zones[zone.name] = zone

        # 4. Virtual Lines (Tripwire)
        line_res = await session.execute(
            select(VirtualLine).where(VirtualLine.camera_id == camera.id, VirtualLine.name == "Entry Gate Tripwire")
        )
        line = line_res.scalars().first()
        if not line:
            line = VirtualLine(
                id=uuid4(),
                camera_id=camera.id,
                name="Entry Gate Tripwire",
                start_point={"x": 0.05, "y": 0.50},
                end_point={"x": 0.95, "y": 0.50},
                direction_mode=DirectionMode.a_to_b,
                color="#5DE271",
                enabled=True,
            )
            session.add(line)
            await session.commit()
            await session.refresh(line)
            logger.info(f"Created virtual line: {line.name}")

        # 5. Analytics Rules
        bay_zone = active_zones.get("Restricted Loading Bay")
        rules_to_create = [
            {
                "name": "Restricted Loading Bay Intrusion",
                "rule_type": RuleType.zone_entry,
                "severity": Severity.medium,
                "object_classes": ["person"],
                "zone_id": bay_zone.id if bay_zone else None,
                "line_id": None,
                "threshold_value": None,
                "cooldown_seconds": 15,
            },
            {
                "name": "Perimeter Tripwire Breach",
                "rule_type": RuleType.line_crossing,
                "severity": Severity.low,
                "object_classes": ["car", "truck"],
                "zone_id": None,
                "line_id": line.id if line else None,
                "threshold_value": None,
                "cooldown_seconds": 10,
            },
            {
                "name": "Excessive Dwell in Loading Bay",
                "rule_type": RuleType.dwell_time,
                "severity": Severity.high,
                "object_classes": ["car", "truck"],
                "zone_id": bay_zone.id if bay_zone else None,
                "line_id": None,
                "threshold_value": 3.0,
                "cooldown_seconds": 30,
            },
            {
                "name": "Loading Bay Overcapacity",
                "rule_type": RuleType.occupancy_threshold,
                "severity": Severity.critical,
                "object_classes": ["person", "car", "truck"],
                "zone_id": bay_zone.id if bay_zone else None,
                "line_id": None,
                "threshold_value": 2.0,
                "cooldown_seconds": 20,
            },
        ]

        for r_spec in rules_to_create:
            r_res = await session.execute(
                select(AnalyticsRule).where(
                    AnalyticsRule.camera_id == camera.id, AnalyticsRule.name == r_spec["name"]
                )
            )
            rule = r_res.scalars().first()
            if not rule:
                rule = AnalyticsRule(
                    id=uuid4(),
                    camera_id=camera.id,
                    name=r_spec["name"],
                    rule_type=r_spec["rule_type"],
                    severity=r_spec["severity"],
                    object_classes=r_spec["object_classes"],
                    zone_id=r_spec["zone_id"],
                    line_id=r_spec["line_id"],
                    threshold_value=r_spec["threshold_value"],
                    cooldown_seconds=r_spec["cooldown_seconds"],
                    enabled=True,
                )
                session.add(rule)
                await session.commit()
                logger.info(f"Created rule: {rule.name}")

    summary = {
        "user_email": DEV_EMAIL,
        "user_password": DEV_PASSWORD,
        "camera_id": str(camera.id),
        "camera_name": camera.name,
        "video_path": str(video_path),
        "zones_count": len(active_zones),
        "lines_count": 1,
        "rules_count": len(rules_to_create),
    }

    print("\n" + "=" * 64)
    print("  VIGILAI — ZERO-FRICTION EVALUATOR DEMO PROVISIONED")
    print("=" * 64)
    print(f"  Operator Email:     {DEV_EMAIL}")
    print(f"  Operator Password:  {DEV_PASSWORD}")
    print(f"  Demo Camera:        {camera.name} ({camera.id})")
    print(f"  Footage Source:     {video_path}")
    print(f"  Spatial Zones:      2 ('Restricted Loading Bay', 'Pedestrian Walkway')")
    print(f"  Virtual Lines:      1 ('Entry Gate Tripwire')")
    print(f"  Analytics Rules:    4 (zone_entry, line_crossing, dwell_time, occupancy)")
    print("=" * 64)
    print("  NEXT STEPS:")
    print("  1. Ensure API is running:    uvicorn vigilai_api.main:app --port 8000")
    print("  2. Ensure Worker is running: python -m apps.worker.main")
    print("  3. Open Dashboard:           http://localhost:3000")
    print(f"  4. Log in and navigate to:   http://localhost:3000/cameras/{camera.id}")
    print("  5. Click 'Start Analytics' to begin real-time detection & tracking!")
    print("=" * 64 + "\n")

    return summary


if __name__ == "__main__":
    asyncio.run(setup_demo_environment())
