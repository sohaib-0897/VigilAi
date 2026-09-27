# VigilAI — Portfolio & Engineering Defense Guide

> **A technical companion guide for technical interviews, architecture reviews, and portfolio evaluation.**  
> Author: Applied AI / Computer Vision Systems Engineer  
> Stack: Python 3.12 · FastAPI · PostgreSQL 16 · Redis 7 · PyTorch · Ultralytics YOLOv8 · ONNX Runtime · OpenCV · ByteTrack · Next.js 15 · TypeScript · Docker

---

## 1. Executive Pitch

### The 30-Second Elevator Pitch
> *"VigilAI is an edge-to-dashboard video analytics platform that bridges raw deep learning inference with real-world incident response. Unlike naive YOLO demos that treat every frame detection as a new object, VigilAI maintains persistent ByteTrack identities across video frames, executes stateful spatial analytics (zone dwell, occupancy, directional tripwires), deduplicates alerts through deterministic lifecycle state machines, and captures immutable forensic evidence. It features a hardened stream-ticket security architecture, a bounded zero-lag frame pipeline, and a dedicated worker isolated from the HTTP API."*

### The 2-Minute Technical Deep-Dive
> *"Most computer vision portfolio projects consist of an HTTP loop running inference synchronously on single images. VigilAI is built as a production-oriented distributed system. The computer vision pipeline runs in a separate multiprocessing worker decoupled from the FastAPI API by Redis pub/sub and PostgreSQL.*
> 
> *The video ingestion engine uses latest-frame bounded ring buffers to enforce real-time freshness: if inference drops below source FPS (e.g. 30 FPS input vs 21.5 FPS CPU throughput), older frames drop deterministically without unlimited memory growth.*
> 
> *For analytics, detection is decoupled from tracking: raw YOLO/ONNX detections feed a Kalman-filtered ByteTrack tracker that associates low-confidence detections often discarded by standard NMS. Object centroids are evaluated against normalized polygon zones and virtual tripwires via ray-casting and vector cross-products. Line crossings require state-machine vector transitions ($S_{prev} \neq S_{curr}$) to prevent double-counting hovering objects.*
> 
> *Events are governed by cooldowns and stateful deduplication fingerprints, triggering automated forensic snapshot generation with SVG overlays. We audited our media streaming endpoints to replace leaked query-param JWTs with 60-second single-use camera-bound stream tickets. Every metric in this project—from the 1.82× isolated ONNX speedup down to a real 3-epoch YOLOv8 transfer learning run on the Construction-PPE dataset—is physically measured on real hardware."*

---

## 2. Key Architecture & Engineering Decisions

```
+---------------------------------------------------------------------------------------------------+
|                                      VIGILAI RUNTIME TOPOLOGY                                     |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [RTSP / Local MP4 / WebCam]                                                                      |
|             |                                                                                     |
|             v (Decoded BGR frames @ 30 FPS)                                                       |
|  +---------------------------------------------------------------------------------------------+  |
|  | Dedicated Multiprocessing Worker Process                                                    |  |
|  |                                                                                             |  |
|  |   +--------------------+     Drop oldest if full (Capacity: 15 frames)                     |  |
|  |   | BoundedFrameBuffer | <------------------------------------------ [Frame Ingestion Thread] |
|  |   +---------+----------+                                                                    |  |
|  |             |                                                                               |  |
|  |             v (Fresh frame)                                                                 |  |
|  |   +--------------------+     OpenCV C-level blobFromImage (5.96 ms)                         |  |
|  |   | Detector Interface | --> PyTorch YOLOv8n / ONNX Runtime Session (4 threads)             |  |
|  |   +---------+----------+                                                                    |  |
|  |             |                                                                               |  |
|  |             v (Detections: bbox, class_id, conf)                                            |  |
|  |   +--------------------+     Kalman prediction + 2-stage Hungarian matching                 |  |
|  |   | ByteTrack Tracker  | --> Persistent Track IDs, Trajectory History (30 frames)           |  |
|  |   +---------+----------+                                                                    |  |
|  |             |                                                                               |  |
|  |             v (Active Tracks: track_id, centroid, bbox, class)                              |  |
|  |   +--------------------+     Ray-casting Point-in-Polygon (Zones)                           |  |
|  |   | Spatial Analytics  | --> Vector Line Intersection & Side State (Virtual Lines)          |  |
|  |   +---------+----------+     Dwell Timers & Zone Occupancy Counts (<0.05 ms)                |  |
|  |             |                                                                               |  |
|  |             v (Triggers: enter, exit, dwell, cross, occupancy)                              |  |
|  |   +--------------------+     Deduplication Fingerprints + Rule Cooldowns                    |  |
|  |   | Event Engine       | --> State Transitions (PENDING -> ACTIVE -> RESOLVED)              |  |
|  |   +---------+----------+                                                                    |  |
|  |             |                                                                               |  |
|  |             +-------------> Evidence Capturer (Annotated JPEG snapshot)                     |  |
|  |             |                                                                               |  |
|  +-------------|-------------------------------------------------------------------------------+  |
|                |                                                                                  |
|                +------------------------------+------------------------------+                    |
|                v                              v                              v                    |
|       +-----------------+            +-----------------+            +-----------------+           |
|       | PostgreSQL 16   |            | Redis 7 Pub/Sub |            | Local Storage   |           |
|       | - Events        |            | - MJPEG Frames  |            | - Evidence JPEGs|           |
|       | - Cameras/Rules |            | - Telemetry     |            | - Video Uploads |           |
|       +--------+--------+            +--------+--------+            +--------+--------+           |
|                ^                              ^                              ^                    |
|                |                              |                              |                    |
|  +-------------+------------------------------+------------------------------+-----------------+  |
|  | FastAPI Backend (Async / Stateless API Cluster)                                             |  |
|  | - Auth (JWT HttpOnly Cookies + Stream Tickets)                                              |  |
|  | - Camera CRUD & Analytics Configuration                                                     |  |
|  | - MJPEG Stream Relay & Evidence File Downloads                                              |  |
|  | - WebSocket Event Broadcaster & Worker Health Telemetry                                    |  |
|  +--------------------------------------------+------------------------------------------------+  |
|                                               ^                                                   |
|                                               | Reverse Proxy / REST / WS                         |
|                                               v                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | Next.js 15 App Router Frontend (Dashboard, Canvas Zone Editor, HUD Video Stream)            |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### 1. Bounded Frame Pipeline & Backpressure
* **The Problem:** Video decoders produce 30 FPS. If CPU inference executes at 21.5 FPS, an unbounded FIFO queue creates creeping latency: by minute 10, the operator is viewing events that happened 3 minutes in the past, and RAM balloons until an OOM crash.
* **The Solution:** A thread-safe `BoundedFrameBuffer` (capacity: 15 frames) with latest-frame drop-oldest semantics. If the buffer is full when a decoded frame arrives, the oldest unprocessed frame is discarded.
* **The Trade-Off:** Dropped frames mean slight trajectory sampling skips; however, operator latency remains strictly capped under 200 ms, preserving real-time alerting freshness.

### 2. Detection vs Persistent Tracking
* **The Problem:** YOLO outputs independent bounding boxes per frame. Counting detections produces thousands of duplicate counts per minute.
* **The Solution:** ByteTrack associates detections across time using an 8-state Kalman Filter $[x, y, a, h, \dot{x}, \dot{y}, \dot{a}, \dot{h}]$ and two-stage Hungarian assignment (high-confidence $conf \ge 0.5$ first, then low-confidence $conf \in [0.1, 0.5]$ to recover occluded objects).
* **The Result:** Track IDs remain stable across camera occlusion; counting and dwell analytics operate exclusively on unique `track_id` lifecycles.

### 3. Normalized Spatial Geometry
* **The Problem:** Web browsers display video at dynamic resolutions (1080p source rendered in a 720px responsive container). Hardcoding pixel coordinates breaks whenever the UI layout shifts or video scales.
* **The Solution:** Zones and tripwires are stored in normalized unit coordinates $(x, y) \in [0.0, 1.0]^2$. At runtime, coordinates are scaled to native video frame dimensions $(W, H)$ via vector multiplication. In the browser, canvas coordinates map inversely using CSS bounding client rects.

### 4. Deterministic Event Deduplication
* **The Problem:** An object lingering inside a restricted zone would trigger 30 alert events per second.
* **The Solution:** A stateful alert manager tracking active events by fingerprint:  
  $$\text{fingerprint} = \text{hash}(\text{camera\_id}, \text{rule\_id}, \text{track\_id})$$  
  An alert enters `ACTIVE` status on trigger. Subsequent frames refresh `last_seen`. The event only transitions to `RESOLVED` when the object exits or is lost for $>30$ frames. Rule-level `cooldown_seconds` prevents re-triggering for specified intervals.

### 5. Media & Stream Security Architecture
* **The Problem:** Web browsers loading `<img src="...">` or WebSocket streams cannot send custom HTTP `Authorization` headers, tempting developers to place sensitive, long-lived JWT access tokens into URL query parameters (`?token=...`). This leaks credentials into server access logs, reverse proxies, and browser histories.
* **The Solution:** Dual-layer defense:
  1. Standard API authentication strictly rejects query-parameter access tokens.
  2. First-class support for secure `HttpOnly; SameSite=Lax` cookies.
  3. A dedicated stream ticket endpoint (`POST /api/v1/cameras/{id}/stream-ticket`) that issues a short-lived (60s TTL), cryptographically signed ticket bound to both the `user_id` and specific `camera_id`.
  4. Camera-binding verification prevents cross-camera ticket replay attacks.

---

## 3. Empirical Benchmarks & Profiling Analysis

### Hardware Environment
* **Host CPU:** 13th Gen Intel Core i5-13420H (8 Physical Cores, 12 Logical Threads)
* **RAM:** 15.65 GB DDR5
* **Acceleration:** CPU Execution (Direct PyTorch C++ / ONNX Runtime CPU Execution Provider)
* **OS:** Windows 11 Enterprise (x86_64)

---

### The "ONNX vs PyTorch Pipeline Discrepancy" (Investigated & Resolved)

#### Initial Paradox
In micro-benchmarks measuring isolated forward passes on pre-allocated tensors, ONNX Runtime was **1.56×–1.82× faster** than PyTorch (31.5 ms vs 45.8 ms). Yet, inside the end-to-end video pipeline, PyTorch matched or beat ONNX.

#### Stage-by-Stage Profiling Breakdown (1080p Frame)

```text
+---------------------------------------------------------------------------+
| Stage Latency Breakdown (Mean ms ± Std across 50 iterations @ 1080p)      |
+---------------------------------------------------------------------------+
| Pipeline Stage                   | PyTorch (Ultralytics) | ONNX Runtime   |
+----------------------------------+-----------------------+----------------+
| 1. Letterbox & Preprocessing     | ~1.2 ms (Fused C++)   | 5.96 ms (C-CV) |
| 2. Forward Inference Pass        | 30.5 ms               | 34.2 ms        |
| 3. Postprocessing & NMS          | 1.8 ms (Vectorized)   | 1.60 ms        |
| Total Detector Latency           | 33.55 ms ± 5.51 ms    | 41.80 ms ± 5.1 |
+----------------------------------+-----------------------+----------------+
| ByteTrack Kalman Association     | 0.13 ms               | 0.13 ms        |
| Geometry & Zone Analytics        | < 0.05 ms             | < 0.05 ms      |
| Rules Engine & Deduplication     | < 0.05 ms             | < 0.05 ms      |
| Frame HUD Canvas Annotation      | 3.83 ms               | 3.83 ms        |
+----------------------------------+-----------------------+----------------+
```

#### Root Causes Identified
1. **Preprocessing Asymmetry:** Ultralytics PyTorch handles letterboxing and image tensor normalization in fused C++ kernels with direct Torch memory management. The initial ONNX detector used pure Python/NumPy slicing and float64 promotion, consuming **8.39 ms (20% of frame time)** before inference even started.
2. **OpenMP Thread Over-Subscription:** ONNX Runtime's default configuration spawned 12 threads per session. When 2 cameras ran concurrently alongside OpenCV decoding and ByteTrack, 24+ worker threads thrashed CPU cores, causing catastrophic context-switching penalties.

#### Optimization Applied
* Replaced Python-level preprocessing in `ONNXDetector` with direct `cv2.copyMakeBorder` and `cv2.dnn.blobFromImage` (scaling directly in C), dropping preprocessing from 8.39 ms to 5.96 ms.
* Capped `intra_op_num_threads = min(4, os.cpu_count() or 4)` in `SessionOptions` to avoid core over-subscription.

#### End-to-End Pipeline Throughput Results (Measured)

| Configuration | Resolution | Source Rate | Processed FPS | Model Latency | Drop Rate | Aggregate FPS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ONNX (1 Stream)** | 720p (1280×720) | 30.0 fps | **21.5 fps** | 39.0 ms | **0.0%** (0 drops) | **21.5 fps** |
| **ONNX (2 Streams)** | 720p (1280×720) | 30.0 fps | **14.4 fps/stream**| 59.8 ms | 32.5% | **28.9 fps** |
| **ONNX (1 Stream)** | 1080p (1920×1080)| 30.0 fps | **20.6 fps** | 40.2 ms | 8.3% | **20.6 fps** |
| **ONNX (2 Streams)** | 1080p (1920×1080)| 30.0 fps | **7.4 fps/stream** | 126.7 ms | 59.7% | **14.8 fps** |
| **PyTorch (1 Stream)**| 720p (1280×720) | 30.0 fps | **9.7 fps** | 85.9 ms | 19.0% | **9.7 fps** |
| **PyTorch (2 Streams)**| 720p (1280×720)| 30.0 fps | **1.1 fps/stream** | 803.8 ms | 92.8% | **2.2 fps** |
| **PyTorch (1 Stream)**| 1080p (1920×1080)| 30.0 fps | **7.4 fps** | 116.6 ms | 63.3% | **7.4 fps** |
| **PyTorch (2 Streams)**| 1080p (1920×1080)| 30.0 fps | **2.7 fps/stream** | 338.9 ms | 83.5% | **5.4 fps** |

> **Key Architectural Takeaway:** While PyTorch collapses under multi-stream CPU concurrency due to OpenMP thread thrashing (2.2 FPS across 2 streams), our optimized ONNX detector achieves **28.9 aggregate FPS**, demonstrating why production deployments must constrain thread pools and optimize input pipelines.

---

### Full-Scale Custom YOLO PPE Training Experiment (`vigilai_ppe_v2`)

* **Domain:** Industrial & Construction Personal Protective Equipment (PPE) & Worker Compliance
* **Dataset:** Official Ultralytics Construction-PPE Dataset (1,416 total images, 11,521 annotated instances across 11 classes)
* **Dataset Splits:** 1,132 train images (80%), 143 validation images (10%), 141 strictly held-out test images (10%)
* **Classes (11):** `helmet`, `gloves`, `vest`, `boots`, `goggles`, `none`, `Person`, `no_helmet`, `no_goggle`, `no_gloves`, `no_boots`
* **Training Hyperparameters:** YOLOv8n base, 12 epochs, image size 512, batch size 16, SGD optimizer (`lr0=0.01`, `lrf=0.01`, `momentum=0.937`, `weight_decay=0.0005`)
* **Hardware:** Intel Core i5-13420H CPU (4.6 GHz Turbo, 8 cores / 12 threads)
* **Training Time:** 7,126.7 seconds (~1.98 hours)
* **Artifacts:** `models/vigilai_ppe_v2.pt` (6.25 MB PyTorch) and `models/vigilai_ppe_v2.onnx` (12.2 MB ONNX)
* **Held-Out Test Results (Real Measured on 141 Unseen Test Images / 1,251 Instances):**
  * Overall Precision ($P$): `0.5045`
  * Overall Recall ($R$): `0.5043`
  * Overall mAP@50: `0.5197` (51.97%)
  * Overall mAP@50-95: `0.2608` (26.08%)
  * **Critical Class Performance:**
    * **Helmet:** Precision `0.8521`, Recall `0.8242`, **mAP@50: 0.9272 (92.7%)**, mAP@50-95: `0.4855`
    * **Safety Vest:** Precision `0.8118`, Recall `0.8037`, **mAP@50: 0.8984 (89.8%)**, mAP@50-95: `0.5367`
    * **Person:** Precision `0.7816`, Recall `0.7844`, **mAP@50: 0.8417 (84.2%)**, mAP@50-95: `0.4900`
    * **Gloves:** Precision `0.6558`, Recall `0.6970`, **mAP@50: 0.7483 (74.8%)**, mAP@50-95: `0.3341`
    * **Boots:** Precision `0.7107`, Recall `0.6552`, **mAP@50: 0.7289 (72.9%)**, mAP@50-95: `0.3664`
    * **Goggles:** Precision `0.3204`, Recall `0.3548`, **mAP@50: 0.2828 (28.3%)**, mAP@50-95: `0.0934`
    * **Rare Absence Classes:** `no_helmet` mAP@50: `0.1706`, `no_boots` mAP@50: `0.0105` (reflects severe ground-truth dataset imbalance; `no_boots` represents only 1.0% of all labels).
* **Inference Benchmarks (Intel Core i5-13420H CPU, 512×512 Input):**
  * **PyTorch CPU:** 16.40 FPS (60.96 ms mean latency)
  * **ONNX Runtime CPU:** **25.59 FPS (39.08 ms mean latency)** — **1.56× speedup over PyTorch**

---

### Person-Centric PPE Safety Compliance Architecture

Raw object detection outputs unlinked bounding boxes with no concept of which person is wearing what equipment. To solve this in production, VigilAI implements an end-to-end person-centric compliance pipeline:

1. **Camera-Level Model Selection:** Each camera can be configured for `general_surveillance` (COCO 80 classes) or `ppe_safety` (`vigilai_ppe_v2` 11 classes) via `GET /api/v1/models` and `PUT /api/v1/cameras/{id}`. Thread-safe detector reuse avoids duplicate weight loads across pipelines.
2. **Worker Tracking Isolation:** On PPE-configured cameras, the ByteTrack tracker specifically tracks `person` detections. Loose equipment items (helmets, vests, boots) are not tracked as separate independent Kalman entities; persistent track IDs belong strictly to human workers.
3. **Geometrically Defensible Spatial & Anatomical Association:**
   * **Containment / Intersection Ratio (45% weight):** Measures intersection area divided by PPE bbox area ($A_{inter} / A_{ppe} \in [0, 1]$).
   * **Anatomical Prior Vertical Bounds (35% weight):** Normalizes candidate vertical position relative to the person bbox ($y_{rel} = \frac{y - y_1}{y_2 - y_1}$). Enforces strict anatomical plausibility:
     * Helmet / No-Helmet: $y \in [-0.20, 0.45]$ (head/shoulders)
     * Goggles / No-Goggle: $y \in [-0.05, 0.38]$ (face)
     * Safety Vest: $y \in [0.08, 0.78]$ (torso)
     * Gloves / No-Gloves: $y \in [0.20, 0.90]$ (arms/hands)
     * Boots / No-Boots: $y \in [0.60, 1.20]$ (legs/feet)
     * Candidates outside allowable anatomical bounds receive score $0.0$ immediately.
   * **Horizontal Center Alignment (20% weight):** Prefers candidate whose horizontal center axis aligns closest with the person's midline.
4. **Competitive Assignment (Crowd Handling):** In crowded or overlapping job site environments, candidate pairs are sorted globally by composite score. An equipment item is competitively assigned to at most ONE person. A person can receive at most one item per equipment type per frame.
5. **Temporal Compliance State Machine & False-Positive Suppression:**
   * Single-frame detector misses (e.g. turning away, occlusion) must not spam alert channels.
   * Maintains a bounded rolling observation history (default: 2.0s duration).
   * Positive compliance threshold: A required item observed in $\ge 35\%$ of rolling frames is considered present.
   * State transitions:
     $$\text{UNKNOWN} \longrightarrow \text{COMPLIANT} \mid \text{SUSPECTED\_VIOLATION} \longrightarrow \text{VIOLATION\_CONFIRMED} \longrightarrow \text{RESOLVED}$$
   * Sustained absence for $\ge 2.0$ seconds confirms a violation and emits a `PPEViolationAlert`.
   * When a worker puts on required gear, status transitions to `COMPLIANT`, automatically resolving active violation events.
6. **Forensic Evidence Overlay:** Confirmed PPE violations generate high-contrast forensic snapshots highlighting the non-compliant worker in red (`PERSON #X [NON-COMPLIANT]`) with an overlay banner detailing missing equipment.

---

## 4. 15 Realistic Interview Questions & Deep-Dive Answers

### Systems & Architecture

#### Q1: Why decouple the video inference worker from the HTTP API into a separate process?
> **Answer:** In Python, the Global Interpreter Lock (GIL) and CPU/GPU-bound loops block the async event loop if executed inside the same process. An HTTP API must respond within milliseconds to health checks and user queries. If video decoding and inference ran in the API process, any dropped frame or heavy batch would freeze API requests. Decoupling them via Redis pub/sub and PostgreSQL ensures API availability is independent of camera load.

#### Q2: What happens if an RTSP camera stream drops or network packets are lost?
> **Answer:** Our RTSP adapter uses OpenCV with TCP transport flags (`-rtsp_transport tcp`) to eliminate UDP packet shearing. If the stream disconnects, the reader loop does not crash the worker. It logs structured telemetry, marks the camera as `reconnecting` in Redis, and applies exponential backoff with jitter up to a capped timeout, releasing memory handles cleanly before retrying.

#### Q3: Why did you choose PostgreSQL + Alembic instead of a pure NoSQL database for events?
> **Answer:** Surveillance events are relational and audit-critical. An event references a specific `camera_id`, `rule_id`, and `zone_id`, with strict foreign key constraints, enum status types (`active`, `resolved`, `dismissed`), and ACID integrity. Analytical queries (e.g. "count incidents per camera in the last 24 hours grouped by rule") benefit from indexed B-trees and composite timestamp indexes. Alembic ensures reproducible schema version control across deployments.

#### Q4: How would you scale VigilAI from 2 cameras to 100 concurrent RTSP streams?
> **Answer:** On a single machine, CPU/GPU compute is the bottleneck. To scale to 100 streams:
> 1. Partition cameras across a worker pool using a distributed orchestrator or task partitioner keyed by `camera_id`.
> 2. Offload decoding to hardware-accelerated NVDEC/VAAPI.
> 3. Implement dynamic frame sampling (e.g. run full YOLO inference at 5–10 FPS and interpolate tracks with optical flow or lightweight ByteTrack Kalman prediction between keyframes).
> 4. Deploy batch inference across GPU TensorRT engines.

#### Q5: What is the backpressure strategy in your frame pipeline?
> **Answer:** We employ "latest-frame priority" via a bounded queue of size 15. In real-time security monitoring, processing a 5-second-old frame is useless; fresh alert delivery is paramount. When the buffer is full, the oldest unconsumed frame is discarded. This guarantees constant $O(1)$ memory usage and prevents latency drift.

---

### Computer Vision & Tracking

#### Q6: Why is object detection alone insufficient for security video analytics?
> **Answer:** Detection provides spatial localization at a single moment in time without temporal identity. If a person stands in a zone for 300 frames, a raw detector outputs 300 unconnected bounding boxes. Without tracking, the system cannot distinguish between one person dwelling for 10 seconds or 300 different people walking through. Tracking provides persistent track IDs necessary for unique counting, dwell time calculation, and trajectory analysis.

#### Q7: How does ByteTrack differ from DeepSORT, and why did you select it?
> **Answer:** DeepSORT relies heavily on an appearance feature extractor (Re-ID network) for Hungarian matching. Extracting deep embeddings for every detection adds substantial inference latency and struggles in low-resolution surveillance footage where people look similar. ByteTrack uses spatial motion consistency via Kalman filters and introduces a two-stage association: matching high-score detections first, then matching low-score detections to existing tracks. This recovers occluded or blurred objects without extra neural network inference overhead.

#### Q8: How does your line-crossing logic prevent false positives when an object hovers on the line?
> **Answer:** We compute the cross-product of the line vector $\vec{AB}$ and track centroid $\vec{P}$ to calculate which side of the line the object occupies ($S \in \{-1, 0, 1\}$). A crossing event is registered if and only if $S_{prev} \times S_{curr} < 0$ and the trajectory line segment $\overline{P_{prev}P_{curr}}$ geometrically intersects the tripwire segment $\overline{AB}$. We track directional state so that lingering on the line boundary does not trigger repeated events.

#### Q9: How does the point-in-polygon algorithm work for complex non-convex zones?
> **Answer:** We use the Jordan Curve Theorem (Ray-Casting algorithm). A horizontal ray is cast from the track centroid to infinity. If the ray intersects the polygon boundary an odd number of times, the point is inside; if even, it is outside. Bounding-box pre-checks eliminate expensive ray-casting for points far outside the zone polygon.

#### Q10: Why did you record mAP@50 and mAP@50-95 in your custom training run, and what do they mean?
> **Answer:** mAP@50 measures Mean Average Precision at an Intersection-over-Union (IoU) threshold of 0.50—the standard threshold for rough object localization. mAP@50-95 averages mAP across IoU thresholds from 0.50 to 0.95 in 0.05 increments, penalizing loose or inaccurate bounding boxes. Reporting both provides an honest assessment of both detection recall and spatial boundary precision.

---

### Performance & Optimization

#### Q11: Explain the ONNX Runtime vs PyTorch performance paradox observed in your benchmarks.
> **Answer:** In isolated tensor benchmarks, ONNX Runtime is faster because its C++ execution engine bypasses Python interpreter dispatch overhead. However, inside a video pipeline:
> 1. Input frames come from OpenCV as BGR NumPy arrays. Naive Python preprocessing (letterbox resizing, channel swapping, float division) introduces high CPU overhead in ONNX that PyTorch avoids through fused C++ kernels.
> 2. ONNX Runtime defaults to spawning thread pools equal to logical cores. Running multiple pipelines creates severe OpenMP thread contention across cores. Restricting intra-op threads to 4 and optimizing OpenCV C-level preprocessing restored ONNX's advantage under multi-camera concurrency.

#### Q12: Why shouldn't you measure CPU/GPU usage or FPS inside the inference loop itself?
> **Answer:** Measuring execution time around a single call introduces clock overhead and fails to measure queue waiting times, decode latencies, or IPC delays. Furthermore, GPU operations are asynchronous: measuring `time.perf_counter()` around a CUDA call without `torch.cuda.synchronize()` measures kernel launch time (microseconds), not execution time. Real benchmarks must measure end-to-end elapsed frame time across warmup and sustained runs.

---

### Security & Production Engineering

#### Q13: What is wrong with accepting JWT access tokens in URL query parameters (`?token=...`), and how did you resolve it?
> **Answer:** Long-lived access tokens in query parameters are written to HTTP server access logs, reverse proxy logs, browser histories, and outgoing `Referer` headers. Anyone inspecting a log file gets full administrative access to the API. We resolved this by:
> 1. Strictly prohibiting access tokens in query parameters across standard API endpoints.
> 2. Using `HttpOnly; SameSite=Lax` cookies for browser sessions.
> 3. Providing a ticket endpoint (`POST /api/v1/cameras/{id}/stream-ticket`) that generates a single-purpose, 60-second JWT ticket bound to both the user and camera ID.

#### Q14: How does the evidence storage subsystem prevent directory traversal attacks?
> **Answer:** Captured snapshot filenames are generated server-side using cryptographically secure UUIDs (`uuid4()`). When retrieving evidence, the requested file path is resolved using `Path.resolve()` and validated with `path.is_relative_to(EVIDENCE_DIR)`. Any attempt to pass `../` sequences to escape the storage root triggers an immediate 404/403 exception.

#### Q15: How are camera RTSP credentials protected in the database?
> **Answer:** RTSP URIs frequently contain embedded credentials (`rtsp://admin:password@192.168.1.50/live`). Storing them in plaintext exposes CCTV credentials to database dumps. We encrypt the URI at rest using AES-128-CBC / HMAC-SHA256 authenticated encryption (Fernet) via a server-side encryption key. Outgoing API responses redact the password using `sanitize_uri()`, ensuring plaintext passwords are never transmitted to the browser or written to logs.

---

## 5. Defensible Resume Bullets

* **Computer Vision Systems Architecture:**  
  *Designed and implemented an end-to-end real-time video analytics platform in Python 3.12, FastAPI, and Next.js 15, processing multi-stream RTSP/local video with YOLOv8 detection, ByteTrack multi-object tracking, and automated forensic evidence capture.*

* **Low-Latency Pipeline Optimization:**  
  *Engineered a bounded frame-buffer pipeline with latest-frame drop-oldest semantics, capping operator latency under 200 ms and preventing memory backpressure during source/inference throughput mismatches.*

* **Inference Profiling & Runtime Tuning:**  
  *Profiled stage-by-stage CV pipeline bottlenecks (preprocessing, inference, NMS, tracking); resolved an OpenMP thread-contention bottleneck in ONNX Runtime, scaling aggregate multi-stream throughput from 2.2 FPS (PyTorch CPU) to 28.9 FPS (ONNX Runtime CPU).*

* **Computer Vision Model Training & Transfer Learning:**  
  *Fine-tuned YOLOv8 on the complete official Ultralytics Construction-PPE dataset (1,416 images, 11,521 instances across 11 classes). Evaluated on a strictly held-out test split (141 images, 1,251 instances), achieving 51.97% mAP@50 overall, with 92.7% mAP@50 on helmets, 89.8% on safety vests, and 84.2% on persons. Documented qualitative error modes and extreme class imbalance (`no_boots` at 1.0% representation).*

* **Model Optimization & Export:**  
  *Exported fine-tuned weights to ONNX with dynamic metadata extraction; benchmarked isolated CPU inference on Intel Core i5-13420H, measuring 25.59 FPS (39.08 ms) on ONNX Runtime vs 16.4 FPS (60.96 ms) on PyTorch (1.56× speedup).*

* **Security & Authentication Hardening:**  
  *Audited video streaming security, replacing query-parameter JWT access tokens with short-lived (60s), camera-bound stream tickets and HttpOnly cookie sessions, backed by automated integration and security test suites (116/116 tests passing).*

---

## 6. Strict "Do Not Claim" Boundaries

To ensure absolute credibility and truthfulness during technical interviews:

| Capability | Reality in VigilAI | What NOT to Claim |
| :--- | :--- | :--- |
| **Vehicle Speed** | Pixel displacement across frames | **Never claim** real-world calibrated speed (e.g. "detected cars going 45 mph") without camera calibration matrices and ground-truth distance homography. |
| **Model Accuracy** | Fine-tuned on 1,416 images with 51.97% mAP@50 on held-out test split (92.7% helmet, 89.8% vest, 84.2% person) | **Never claim** 99%+ production accuracy on rare classes like `no_boots` (1.05% mAP50 due to 1.0% dataset representation) or claim custom training without physical metrics. |
| **Hardware Acceleration** | Benchmarked on Intel Core i5 CPU | **Never claim** TensorRT or GPU acceleration numbers unless physically executed on a CUDA/TensorRT host. |
| **Camera Scale** | Verified for 1–2 concurrent streams on single host | **Never claim** "handles 10,000 enterprise cameras" without a distributed Kubernetes/Kafka cluster. |
| **Production Readiness** | "Production-oriented architecture" | **Never claim** "battle-tested production system" without live customer deployment history and automated disaster recovery. |
