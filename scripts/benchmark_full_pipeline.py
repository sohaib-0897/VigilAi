"""
VigilAI — Full Pipeline Real-Time Benchmark Suite

Benchmarks the entire end-to-end computer vision and analytics pipeline:
  Video Decode (30 FPS source) -> Bounded Queue (Latest-Frame semantics)
  -> YOLO/ONNX Detection -> ByteTrack Tracking -> Geometry & Zones/Lines/Dwell
  -> Rules Engine -> Event Manager & Deduplication -> Frame Annotator

Measures and records:
- Processed FPS (actual full-pipeline throughput)
- Model Inference Latency (Mean, P50, P95 in ms)
- Input Resolution (1280x720 and 1920x1080)
- Hardware Specifications (CPU, GPU, RAM)
- Dropped / Skipped Frames (backpressure buffer drops vs 30 FPS source)
- Source FPS (30.0 FPS)
- 1 Stream vs 2 Concurrent Streams scaling

All measurements are executed on real hardware with real frames — never fabricated.
"""

import argparse
import json
import os
import platform
import sys
import time
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import MagicMock

import cv2
import numpy as np
import psutil

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Mock worker_db before importing pipeline components to avoid requiring live PostgreSQL
import apps.worker.db as worker_db

def setup_mock_db():
    worker_db.load_zones = MagicMock(return_value=[
        {
            "id": "zone-security-a",
            "name": "Perimeter Security Zone",
            "points": [{"x": 0.05, "y": 0.05}, {"x": 0.95, "y": 0.05}, {"x": 0.95, "y": 0.95}, {"x": 0.05, "y": 0.95}],
            "color": "#ff0055"
        }
    ])
    worker_db.load_lines = MagicMock(return_value=[
        {
            "id": "line-tripwire-1",
            "name": "Midpoint Entry Line",
            "start_point": {"x": 0.5, "y": 0.0},
            "end_point": {"x": 0.5, "y": 1.0},
            "direction_mode": "both",
            "color": "#00ffcc"
        }
    ])
    worker_db.load_rules = MagicMock(return_value=[
        {
            "id": "rule-entry",
            "name": "Zone Entry Alert",
            "rule_type": "zone_entry",
            "enabled": True,
            "severity": "high",
            "zone_id": "zone-security-a",
            "line_id": None,
            "object_classes": ["person", "car", "bus"],
            "threshold_value": None,
            "cooldown_seconds": 10,
            "configuration": {}
        },
        {
            "id": "rule-line",
            "name": "Tripwire Crossing",
            "rule_type": "line_crossing",
            "enabled": True,
            "severity": "medium",
            "zone_id": None,
            "line_id": "line-tripwire-1",
            "object_classes": ["person", "bus"],
            "threshold_value": None,
            "cooldown_seconds": 10,
            "configuration": {}
        }
    ])
    worker_db.update_camera_status = MagicMock()
    worker_db.save_track_summary = MagicMock()
    worker_db.save_event = MagicMock(return_value="evt-mock-id")
    worker_db.save_evidence = MagicMock(return_value="evi-mock-id")
    worker_db.finish_camera = MagicMock()

setup_mock_db()

from apps.worker.pipeline import CameraPipeline
from vigilai_api.cv.detection.onnx_detector import ONNXDetector
from vigilai_api.cv.detection.yolo import YOLODetector
from vigilai_api.cv.tracking.byte_tracker import ByteTrackTracker


def get_hardware_info() -> dict:
    """Collect real host hardware specifications."""
    info = {
        "platform": platform.platform(),
        "python_version": platform.python_version(),
        "cpu_processor": platform.processor() or "unknown",
        "cpu_physical_cores": psutil.cpu_count(logical=False),
        "cpu_logical_cores": psutil.cpu_count(logical=True),
        "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
        "ram_available_gb": round(psutil.virtual_memory().available / (1024**3), 2),
    }

    try:
        import torch
        if torch.cuda.is_available():
            info["gpu_name"] = torch.cuda.get_device_name(0)
            info["gpu_vram_gb"] = round(torch.cuda.get_device_properties(0).total_mem / (1024**3), 2)
            info["cuda_version"] = torch.version.cuda
            info["acceleration"] = "CUDA"
        else:
            info["gpu_name"] = "NOT_AVAILABLE"
            info["gpu_vram_gb"] = "NOT_AVAILABLE"
            info["cuda_version"] = "NOT_AVAILABLE"
            info["acceleration"] = "CPU_EXECUTION"
    except ImportError:
        info["gpu_name"] = "NOT_AVAILABLE"
        info["acceleration"] = "CPU_EXECUTION"

    return info


def create_detector(backend: str):
    """Instantiate detector based on backend."""
    if backend == "onnx":
        model_path = "models/yolov8n.onnx"
        if not Path(model_path).exists():
            raise FileNotFoundError(f"ONNX model not found: {model_path}")
        det = ONNXDetector(model_path, device="cpu")
        det.warmup(3)
        return det
    elif backend == "pytorch":
        model_path = "yolov8n.pt"
        if not Path(model_path).exists():
            raise FileNotFoundError(f"PyTorch model not found: {model_path}")
        det = YOLODetector(model_path, device="cpu")
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        for _ in range(3):
            det.detect(dummy)
        return det
    else:
        raise ValueError(f"Unknown backend: {backend}")


def run_pipeline_test(
    backend: str,
    video_path: str,
    resolution_label: str,
    resolution_dims: tuple[int, int],
    num_streams: int,
    queue_size: int = 15,
) -> dict:
    """Execute end-to-end pipeline benchmark for 1 or 2 concurrent streams."""
    print(f"\n--- Benchmarking {backend.upper()} | {resolution_label} ({resolution_dims[0]}x{resolution_dims[1]}) | {num_streams} Stream(s) ---")

    evidence_dir = Path(".verification/evidence_benchmarks")
    evidence_dir.mkdir(parents=True, exist_ok=True)

    pipelines = []
    for i in range(num_streams):
        cam_id = f"benchmark-cam-{i+1}"
        detector = create_detector(backend)
        pipeline = CameraPipeline(
            camera_id=cam_id,
            camera_config={"source_type": "local_video", "source_uri": video_path},
            detector=detector,
            tracker_factory=lambda: ByteTrackTracker(track_thresh=0.45, track_buffer=30, match_thresh=0.8),
            redis_client=None,
            evidence_dir=str(evidence_dir),
            frame_queue_size=queue_size,
        )
        pipelines.append(pipeline)

    # Start all pipelines concurrently
    start_time = time.perf_counter()
    for p in pipelines:
        p.start()

    # Wait for completion (with timeout)
    timeout = 60.0
    while any(p.is_running for p in pipelines):
        if time.perf_counter() - start_time > timeout:
            print(f"Warning: Timed out after {timeout}s")
            for p in pipelines:
                p.stop()
            break
        time.sleep(0.1)

    total_duration = time.perf_counter() - start_time

    # Collect stats from all streams
    stream_results = []
    total_received = 0
    total_processed = 0
    total_dropped = 0
    total_events = 0
    inference_times_all = []

    for idx, p in enumerate(pipelines):
        stats = p.stats.to_dict()
        rcv = stats["frames_received"]
        proc = stats["frames_processed"]
        drop = stats["frames_dropped"]
        avg_inf = stats["avg_inference_ms"]
        p95_inf = stats["p95_inference_ms"]
        fps = round(proc / total_duration, 2) if total_duration > 0 else 0.0
        drop_pct = round((drop / rcv) * 100, 1) if rcv > 0 else 0.0

        stream_results.append({
            "stream_index": idx + 1,
            "camera_id": p.stats.camera_id,
            "frames_received": rcv,
            "frames_processed": proc,
            "frames_dropped": drop,
            "drop_rate_pct": drop_pct,
            "processed_fps": fps,
            "avg_inference_ms": round(avg_inf, 2),
            "p95_inference_ms": round(p95_inf, 2),
            "events_detected": stats["total_events"],
        })

        total_received += rcv
        total_processed += proc
        total_dropped += drop
        total_events += stats["total_events"]
        if avg_inf > 0:
            inference_times_all.append(avg_inf)

    # Aggregate metrics
    aggregate_processed_fps = round(total_processed / total_duration, 2)
    overall_drop_pct = round((total_dropped / total_received) * 100, 1) if total_received > 0 else 0.0
    mean_inf_latency = round(float(np.mean(inference_times_all)), 2) if inference_times_all else 0.0

    print(f"  Result: Aggregate Processed FPS: {aggregate_processed_fps} | Mean Inf: {mean_inf_latency}ms | Drop Rate: {overall_drop_pct}% ({total_dropped}/{total_received} frames)")
    if num_streams > 1:
        for sr in stream_results:
            print(f"    Stream {sr['stream_index']}: {sr['processed_fps']} FPS | {sr['avg_inference_ms']}ms inf | {sr['drop_rate_pct']}% dropped")

    return {
        "backend": backend,
        "input_resolution": f"{resolution_dims[0]}x{resolution_dims[1]}",
        "resolution_label": resolution_label,
        "source_fps": 30.0,
        "num_streams": num_streams,
        "queue_capacity": queue_size,
        "benchmark_duration_seconds": round(total_duration, 2),
        "aggregate_processed_fps": aggregate_processed_fps,
        "per_stream_avg_processed_fps": round(aggregate_processed_fps / num_streams, 2),
        "mean_model_inference_ms": mean_inf_latency,
        "total_frames_received": total_received,
        "total_frames_processed": total_processed,
        "total_frames_dropped": total_dropped,
        "overall_drop_rate_pct": overall_drop_pct,
        "total_security_events": total_events,
        "streams": stream_results,
    }


def run_benchmark_suite(output_file: str = "benchmarks/pipeline_benchmarks.json"):
    print("=" * 80)
    print("  VigilAI Real-Time CV Pipeline Benchmark Suite")
    print("  Measuring: Processed FPS, Model Latency, Dropped Frames, 1 vs 2 Streams")
    print("=" * 80)

    hardware = get_hardware_info()
    print("\nHost Hardware Environment:")
    print(f"  CPU: {hardware['cpu_processor']} ({hardware['cpu_physical_cores']} cores / {hardware['cpu_logical_cores']} threads)")
    print(f"  RAM: {hardware['ram_total_gb']} GB")
    print(f"  GPU: {hardware['gpu_name']} ({hardware['acceleration']})")

    video_720p = "benchmarks/data/benchmark_720p_30fps.avi"
    video_1080p = "benchmarks/data/benchmark_1080p_30fps.avi"

    if not Path(video_720p).exists() or not Path(video_1080p).exists():
        print("\nGenerating benchmark test videos...")
        from scripts.prepare_benchmark_videos import create_benchmark_videos
        create_benchmark_videos()

    matrix = [
        # ONNX Runtime (CPU)
        {"backend": "onnx", "video": video_720p, "label": "720p", "dims": (1280, 720), "streams": 1},
        {"backend": "onnx", "video": video_720p, "label": "720p", "dims": (1280, 720), "streams": 2},
        {"backend": "onnx", "video": video_1080p, "label": "1080p", "dims": (1920, 1080), "streams": 1},
        {"backend": "onnx", "video": video_1080p, "label": "1080p", "dims": (1920, 1080), "streams": 2},

        # PyTorch YOLOv8 (CPU)
        {"backend": "pytorch", "video": video_720p, "label": "720p", "dims": (1280, 720), "streams": 1},
        {"backend": "pytorch", "video": video_720p, "label": "720p", "dims": (1280, 720), "streams": 2},
        {"backend": "pytorch", "video": video_1080p, "label": "1080p", "dims": (1920, 1080), "streams": 1},
        {"backend": "pytorch", "video": video_1080p, "label": "1080p", "dims": (1920, 1080), "streams": 2},
    ]

    all_results = []
    for test in matrix:
        res = run_pipeline_test(
            backend=test["backend"],
            video_path=test["video"],
            resolution_label=test["label"],
            resolution_dims=test["dims"],
            num_streams=test["streams"],
        )
        all_results.append(res)
        time.sleep(0.5)

    suite_report = {
        "benchmark_timestamp": datetime.now(UTC).isoformat(),
        "hardware": hardware,
        "pipeline_architecture": {
            "source_fps": 30.0,
            "pipeline_stages": [
                "Video Decode",
                "Bounded FrameBuffer (Drop-oldest)",
                "YOLO / ONNX Inference",
                "ByteTrack Multi-Object Tracking",
                "Zone Analytics (Point-in-Polygon)",
                "Line Analytics (Intersection & Direction)",
                "Dwell Analytics",
                "Rules Engine",
                "Event Manager (Deduplication)",
                "Frame Annotator"
            ]
        },
        "results": all_results,
    }

    out_p = Path(output_file)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    with open(out_p, "w", encoding="utf-8") as f:
        json.dump(suite_report, f, indent=2)

    print("\n" + "=" * 80)
    print(f"Benchmark Suite Completed! Results persisted to: {out_p}")
    print("=" * 80)

    # Print clean summary table
    print("\nSUMMARY TABLE FOR PORTFOLIO & RESUME:")
    print(f"{'Configuration':<24} | {'Res':<7} | {'Src FPS':<7} | {'Proc FPS':<8} | {'Model Latency':<13} | {'Drop Rate':<10} | {'Agg FPS':<8}")
    print("-" * 90)
    for r in all_results:
        cfg = f"{r['backend'].upper()} ({r['num_streams']} stream{'s' if r['num_streams'] > 1 else ''})"
        res = r['resolution_label']
        src = f"{r['source_fps']} fps"
        proc = f"{r['per_stream_avg_processed_fps']:.1f} fps"
        lat = f"{r['mean_model_inference_ms']:.1f} ms"
        drop = f"{r['overall_drop_rate_pct']:.1f}%"
        agg = f"{r['aggregate_processed_fps']:.1f} fps"
        print(f"{cfg:<24} | {res:<7} | {src:<7} | {proc:<8} | {lat:<13} | {drop:<10} | {agg:<8}")

    return suite_report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VigilAI Real-Time CV Pipeline Benchmark")
    parser.add_argument("--output", default="benchmarks/pipeline_benchmarks.json", help="Path to output JSON")
    args = parser.parse_args()
    run_benchmark_suite(args.output)
