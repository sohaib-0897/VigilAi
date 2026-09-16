# VigilAI — Measurement & Benchmark Artifacts

All measurements in this directory reflect actual executions — never fabricated or hand-tuned, in strict compliance with [`AGENTS.md`](../AGENTS.md).

## Host Hardware Environment

- **CPU**: Intel(R) Core(TM) i5-13420H (8 physical cores, 12 threads)
- **RAM**: 15.65 GB (DDR5)
- **GPU**: `NOT_AVAILABLE` (CPU-only execution; CUDA unavailable)
- **OS / Platform**: Windows 11 (10.0.26200), Python 3.12.9

---

## 1. Full Real-Time Video Pipeline Benchmarks (End-to-End)

Artifact: [`pipeline_benchmarks.json`](pipeline_benchmarks.json)

Evaluated on standardized 300-frame (10.0 seconds @ 30.00 FPS) surveillance video feeds with moving vehicles and pedestrians:
```text
30 FPS Surveillance Stream (720p / 1080p)
  → Frame Ingestion Thread
  → Bounded FrameBuffer (maxsize=15, drop-oldest latest-frame backpressure)
  → YOLO / ONNX Detection
  → ByteTrack Multi-Object Tracking
  → Zone Analytics (Point-in-Polygon)
  → Line Analytics (Intersection & Directional Crossings)
  → Dwell Analytics
  → Rules Engine
  → Stateful Event Manager (Deduplication)
  → Frame Annotator HUD
```

### End-to-End Performance Summary

| Configuration | Resolution | Source FPS | Processed FPS | Model Latency | Dropped Frames (Drop %) | Aggregate FPS |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **PyTorch (1 stream)** | **720p** (1280×720) | 30.0 fps | **21.7 fps** | 36.6 ms | 2 / 300 (**0.7%**) | **21.7 fps** |
| **PyTorch (1 stream)** | **1080p** (1920×1080) | 30.0 fps | **17.3 fps** | 52.2 ms | 92 / 300 (**30.7%**) | **17.3 fps** |
| **ONNX (1 stream)** | **720p** (1280×720) | 30.0 fps | **16.7 fps** | 54.1 ms | 60 / 300 (**20.0%**) | **16.7 fps** |
| **ONNX (1 stream)** | **1080p** (1920×1080) | 30.0 fps | **16.1 fps** | 49.3 ms | 80 / 300 (**26.7%**) | **16.1 fps** |
| **PyTorch (2 streams)** | **1080p** (1920×1080) | 30.0 fps | **6.1 fps** / stream | 144.7 ms | 401 / 600 (**66.8%**) | **12.3 fps** |
| **PyTorch (2 streams)** | **720p** (1280×720) | 30.0 fps | **5.6 fps** / stream | 158.3 ms | 427 / 600 (**71.2%**) | **11.2 fps** |
| **ONNX (2 streams)** | **720p** (1280×720) | 30.0 fps | **4.6 fps** / stream | 192.5 ms | 399 / 600 (**66.5%**) | **9.2 fps** |
| **ONNX (2 streams)** | **1080p** (1920×1080) | 30.0 fps | **3.9 fps** / stream | 216.7 ms | 450 / 600 (**75.0%**) | **7.8 fps** |

### Key Engineering Insights (1 Stream vs 2 Streams & Queue Backpressure)

1. **Processed FPS vs. Source FPS**:
   - On 720p @ 30 FPS, the full PyTorch pipeline reaches **21.7 Processed FPS** with **36.6 ms** mean inference latency, dropping only **0.7%** (2 out of 300) frames.
   - At 1080p, single-stream PyTorch maintains **17.3 Processed FPS** (52.2 ms inference), dropping 30.7% of frames to prevent lag accumulation.
2. **Multi-Stream Scalability & CPU Contention**:
   - Running 2 concurrent streams splits CPU resources across worker threads, resulting in an aggregate pipeline throughput of **11.2 – 12.3 FPS** on PyTorch.
   - Under this contention, the bounded `FrameBuffer` cleanly sheds **66.5% – 75.0%** of stale frames with latest-frame drop-oldest semantics, ensuring event alerts and live previews reflect real-time occurrences without memory growth.

---

## 2. Standardized Surveillance Test Streams

Generated using [`scripts/prepare_benchmark_videos.py`](../scripts/prepare_benchmark_videos.py):

| File | Resolution | FPS | Frames | Duration | Description |
| :--- | :---: | :---: | :---: | :---: | :--- |
| [`surveillance_1080p_30fps.mp4`](data/surveillance_1080p_30fps.mp4) | 1920×1080 | 30.0 | 300 | 10.0s | CCTV 1080p stream with moving bus, pedestrians crossing tripwire, and CCTV OSD |
| [`surveillance_1080p_30fps.avi`](data/surveillance_1080p_30fps.avi) | 1920×1080 | 30.0 | 300 | 10.0s | MJPG AVI container for OpenCV decode testing |
| [`surveillance_720p_30fps.mp4`](data/surveillance_720p_30fps.mp4) | 1280×720 | 30.0 | 300 | 10.0s | CCTV 720p stream with pedestrians and vehicle transiting roadway |
| [`surveillance_720p_30fps.avi`](data/surveillance_720p_30fps.avi) | 1280×720 | 30.0 | 300 | 10.0s | MJPG AVI container for OpenCV decode testing |

*(All streams are also synced to `uploads/` for direct UI ingestion).*

---

## 3. Isolated Model Inference Benchmarks

Measured on Host with 10 warmup iterations and 50 measured iterations ($640 \times 640 \times 3$ frames).

| Backend | Artifact | Model Format | Size | FPS | Mean Latency | P50 Latency | P95 Latency | CPU Memory |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **PyTorch CPU** | [`cpu-pytorch-verified.json`](cpu-pytorch-verified.json) | YOLOv8n (.pt) | 6.25 MB | **11.24** | 88.95 ms | 87.32 ms | 112.54 ms | 378.1 MB |
| **ONNX Runtime** | [`cpu-onnx-verified.json`](cpu-onnx-verified.json) | YOLOv8n (.onnx) | 12.23 MB | **20.50** | 48.79 ms | 47.75 ms | 57.02 ms | 289.9 MB |

---

## 4. Truthfulness & Hardware Boundary Disclosures

In adherence to [`AGENTS.md`](../AGENTS.md):

- **TensorRT Acceleration**: `NOT_MEASURED` (Requires NVIDIA TensorRT GPU runtime; host environment has no NVIDIA GPU).
- **GPU Inference Benchmarks**: `NOT_AVAILABLE` / `NOT_MEASURED` on this CPU-only host.
- **Custom Model Training Metrics (mAP@50, mAP@50-95, Precision, Recall)**: `NOT_EXECUTED` (Pretrained COCO weights are utilized for general surveillance classes).

---

## 5. Reproducing Benchmarks

To reproduce these measurements locally:

```bash
# 1. Generate standardized 720p & 1080p 30 FPS surveillance streams
python scripts/prepare_benchmark_videos.py

# 2. Run the full multi-stream pipeline benchmark suite
python scripts/benchmark_full_pipeline.py --output benchmarks/pipeline_benchmarks.json
```
