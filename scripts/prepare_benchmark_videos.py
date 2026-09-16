"""
VigilAI — Standardized Surveillance Benchmark Stream Generator

Generates standardized 720p (1280x720) and 1080p (1920x1080) surveillance video feeds at 30.0 FPS.
Includes:
- Realistic outdoor surveillance environment (roadway, crosswalk, sidewalk)
- Moving vehicle (bus) and multiple pedestrians with continuous smooth trajectories
- Realistic CCTV On-Screen Display (OSD): Camera ID, live timestamp, blinking REC indicator, resolution/FPS
- Both MP4 (mp4v) and AVI (MJPG) formats for browser playback and OpenCV pipeline ingestion
- Exactly 300 frames (10.0 seconds @ 30.00 FPS)
"""

import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

import cv2
import numpy as np
import ultralytics


def create_surveillance_stream(
    width: int,
    height: int,
    fps: float,
    num_frames: int,
    cam_name: str,
    output_base_path: Path,
    bus_crop: np.ndarray,
    person_crop: np.ndarray,
    pedestrian2_crop: np.ndarray,
):
    """Render a realistic 30 FPS surveillance stream with moving targets and CCTV HUD."""
    mp4_path = output_base_path.with_suffix(".mp4")
    avi_path = output_base_path.with_suffix(".avi")

    fourcc_mp4 = cv2.VideoWriter_fourcc(*"mp4v")
    fourcc_avi = cv2.VideoWriter_fourcc(*"MJPG")

    writer_mp4 = cv2.VideoWriter(str(mp4_path), fourcc_mp4, fps, (width, height))
    writer_avi = cv2.VideoWriter(str(avi_path), fourcc_avi, fps, (width, height))

    if not writer_mp4.isOpened() or not writer_avi.isOpened():
        raise RuntimeError(f"Failed to open video writers for {output_base_path}")

    # Base timestamps starting at 2026-09-16 13:27:00
    start_dt = datetime(2026, 9, 16, 13, 27, 0)
    frame_delta = timedelta(seconds=1.0 / fps)

    # Scale crops proportionally to stream resolution
    scale_factor = height / 1080.0

    scaled_bus = cv2.resize(
        bus_crop,
        (max(1, int(bus_crop.shape[1] * scale_factor)), max(1, int(bus_crop.shape[0] * scale_factor)))
    )
    scaled_p1 = cv2.resize(
        person_crop,
        (max(1, int(person_crop.shape[1] * scale_factor)), max(1, int(person_crop.shape[0] * scale_factor)))
    )
    scaled_p2 = cv2.resize(
        pedestrian2_crop,
        (max(1, int(pedestrian2_crop.shape[1] * scale_factor)), max(1, int(pedestrian2_crop.shape[0] * scale_factor)))
    )

    # Pre-render background elements
    road_top = int(height * 0.35)
    road_bot = int(height * 0.85)

    base_bg = np.full((height, width, 3), 75, dtype=np.uint8)  # Sidewalk / building plaza
    base_bg[road_top:road_bot, :] = 45  # Dark asphalt roadway

    # Yellow dashed centerline
    dash_h = max(2, int(8 * scale_factor))
    dash_w = int(60 * scale_factor)
    gap_w = int(60 * scale_factor)
    mid_y = int((road_top + road_bot) / 2)
    for x in range(0, width, dash_w + gap_w):
        base_bg[mid_y - dash_h // 2 : mid_y + dash_h // 2, x : min(width, x + dash_w)] = [25, 205, 240]

    # White crosswalk zebra stripes
    cw_start = int(width * 0.48)
    cw_end = int(width * 0.54)
    stripe_w = max(4, int(15 * scale_factor))
    stripe_gap = max(4, int(15 * scale_factor))
    for y in range(road_top + 10, road_bot - 10, stripe_w + stripe_gap):
        base_bg[y : y + stripe_w, cw_start:cw_end] = [220, 220, 220]

    # Render frames
    for i in range(num_frames):
        frame = base_bg.copy()
        current_time = start_dt + i * frame_delta

        # Target 1: Bus driving left to right across the roadway
        # Starts off-screen left, crosses full width, exits off-screen right
        bus_w = scaled_bus.shape[1]
        bus_h = scaled_bus.shape[0]
        bus_y = road_top + int(15 * scale_factor)
        bus_progress = i / (num_frames * 0.85)  # finishes transit by frame 255
        bus_x = int(-bus_w + (width + bus_w * 2) * bus_progress)

        if bus_x + bus_w > 0 and bus_x < width:
            x1 = max(0, bus_x)
            x2 = min(width, bus_x + bus_w)
            crop_x1 = max(0, -bus_x)
            crop_x2 = crop_x1 + (x2 - x1)
            frame[bus_y : bus_y + bus_h, x1:x2] = scaled_bus[:, crop_x1:crop_x2]

        # Target 2: Pedestrian 1 walking across the crosswalk (top to bottom across tripwire)
        p1_w = scaled_p1.shape[1]
        p1_h = scaled_p1.shape[0]
        p1_x = int(width * 0.50)
        p1_progress = i / num_frames
        p1_y = int(road_top - p1_h * 0.4 + (road_bot - road_top) * p1_progress)

        if 0 <= p1_y and p1_y + p1_h <= height:
            frame[p1_y : p1_y + p1_h, p1_x : p1_x + p1_w] = scaled_p1

        # Target 3: Pedestrian 2 walking along sidewalk right to left
        p2_w = scaled_p2.shape[1]
        p2_h = scaled_p2.shape[0]
        p2_y = int(height * 0.86)
        p2_progress = i / num_frames
        p2_x = int(width * 0.85 - (width * 0.70) * p2_progress)

        if 0 <= p2_x and p2_x + p2_w <= width and p2_y + p2_h <= height:
            frame[p2_y : p2_y + p2_h, p2_x : p2_x + p2_w] = scaled_p2

        # -------------------------------------------------------------
        # CCTV On-Screen Display (OSD) Overlay
        # -------------------------------------------------------------
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.55 * scale_factor
        thickness = max(1, int(1.5 * scale_factor))

        # Top banner background strip (translucent dark bar)
        top_bar_h = int(45 * scale_factor)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, top_bar_h), (10, 10, 10), -1)
        # Bottom bar strip
        cv2.rectangle(overlay, (0, height - top_bar_h), (width, height), (10, 10, 10), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        # 1. Top-Left: Camera Name & Channel
        cv2.putText(frame, cam_name, (int(20 * scale_factor), int(30 * scale_factor)), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

        # 2. Top-Center: Blinking REC indicator
        if (i // 15) % 2 == 0:  # Blinks every 0.5s
            rec_x = int(width * 0.46)
            rec_y = int(28 * scale_factor)
            cv2.circle(frame, (rec_x, rec_y - int(5 * scale_factor)), int(6 * scale_factor), (0, 0, 240), -1)
            cv2.putText(frame, "REC [LIVE]", (rec_x + int(12 * scale_factor), rec_y), font, font_scale, (0, 0, 255), thickness, cv2.LINE_AA)

        # 3. Top-Right: Formatted Timestamp (with ms)
        time_str = current_time.strftime("%Y-%m-%d %H:%M:%S") + f".{int(current_time.microsecond / 1000):03d}"
        time_size = cv2.getTextSize(time_str, font, font_scale, thickness)[0]
        cv2.putText(frame, time_str, (width - time_size[0] - int(20 * scale_factor), int(30 * scale_factor)), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

        # 4. Bottom-Left: Resolution & Frame Rate
        res_str = f"{width}x{height} @ {fps:.2f} FPS | VIGILAI SURVEILLANCE FEED"
        cv2.putText(frame, res_str, (int(20 * scale_factor), height - int(15 * scale_factor)), font, font_scale * 0.85, (200, 200, 200), max(1, thickness - 1), cv2.LINE_AA)

        # 5. Bottom-Right: Security Status
        sec_str = "SYSTEM ARMED | ANALYTICS ACTIVE"
        sec_size = cv2.getTextSize(sec_str, font, font_scale * 0.85, max(1, thickness - 1))[0]
        cv2.putText(frame, sec_str, (width - sec_size[0] - int(20 * scale_factor), height - int(15 * scale_factor)), font, font_scale * 0.85, (50, 220, 50), max(1, thickness - 1), cv2.LINE_AA)

        writer_mp4.write(frame)
        writer_avi.write(frame)

    writer_mp4.release()
    writer_avi.release()
    print(f"  -> Generated MP4: {mp4_path} ({width}x{height} @ {fps} FPS, {num_frames} frames, {num_frames/fps:.1f}s)")
    print(f"  -> Generated AVI: {avi_path} ({width}x{height} @ {fps} FPS, {num_frames} frames, {num_frames/fps:.1f}s)")


def generate_standardized_streams():
    print("=" * 80)
    print("  Generating Standardized 720p & 1080p 30 FPS Surveillance Benchmark Streams")
    print("=" * 80)

    out_dir = Path("benchmarks/data")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load high-confidence source crops from ultralytics assets
    asset_bus = Path(ultralytics.__file__).parent / "assets" / "bus.jpg"
    src_bus = cv2.imread(str(asset_bus))
    if src_bus is None:
        raise FileNotFoundError(f"Could not load asset: {asset_bus}")

    # Crop targets
    # Bus: [23, 231, 805, 757]
    # Pedestrian 1: [49, 399, 245, 903]
    # Pedestrian 2: [669, 392, 810, 877]
    bus_crop = src_bus[231:757, 23:805]
    p1_crop = src_bus[399:903, 49:245]
    p2_crop = src_bus[392:877, 669:810]

    fps = 30.0
    num_frames = 300  # 10.0 seconds @ 30.00 FPS

    # 1. 1080p Stream (1920x1080)
    print("\n[1/2] Generating 1080p Stream (1920x1080 @ 30 FPS, 300 frames)...")
    p1080_base = out_dir / "surveillance_1080p_30fps"
    create_surveillance_stream(
        width=1920,
        height=1080,
        fps=fps,
        num_frames=num_frames,
        cam_name="CAM-01 [NORTH GATE - 1080p]",
        output_base_path=p1080_base,
        bus_crop=bus_crop,
        person_crop=p1_crop,
        pedestrian2_crop=p2_crop,
    )
    # Maintain backwards compatibility aliases for benchmark runner
    shutil.copy(p1080_base.with_suffix(".avi"), out_dir / "benchmark_1080p_30fps.avi")

    # 2. 720p Stream (1280x720)
    print("\n[2/2] Generating 720p Stream (1280x720 @ 30 FPS, 300 frames)...")
    p720_base = out_dir / "surveillance_720p_30fps"
    create_surveillance_stream(
        width=1280,
        height=720,
        fps=fps,
        num_frames=num_frames,
        cam_name="CAM-02 [SOUTH GATE - 720p]",
        output_base_path=p720_base,
        bus_crop=bus_crop,
        person_crop=p1_crop,
        pedestrian2_crop=p2_crop,
    )
    shutil.copy(p720_base.with_suffix(".avi"), out_dir / "benchmark_720p_30fps.avi")

    print("\n" + "=" * 80)
    print("Standardized Streams Successfully Generated:")
    print(f"  1. 1080p MP4: {p1080_base.with_suffix('.mp4')}")
    print(f"  2. 1080p AVI: {p1080_base.with_suffix('.avi')}")
    print(f"  3. 720p  MP4: {p720_base.with_suffix('.mp4')}")
    print(f"  4. 720p  AVI: {p720_base.with_suffix('.avi')}")
    print("=" * 80)


if __name__ == "__main__":
    generate_standardized_streams()
