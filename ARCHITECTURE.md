# Architecture

VigilAI separates HTTP handling from continuous video inference. See the [README diagram](README.md#architecture) for the service flow.

## Service boundaries

- **FastAPI** owns authentication, camera/configuration CRUD, historical queries, evidence access, and browser streams. Routes live under `/api/v1`.
- **CV worker** polls camera configuration, manages per-camera pipelines, runs detection/tracking/analytics, writes events, and captures evidence.
- **PostgreSQL** persists users, cameras, normalized zones/lines, rules, events, and evidence metadata. Models are in `apps/api/vigilai_api/db/models`; migrations are in `apps/api/migrations`.
- **Redis** carries event notifications, recent annotated frames, camera status, and expiring worker health state.
- **Next.js** presents camera management, geometry configuration, live previews, events, analytics, and system health.

## Frame and analytics path

`CameraPipeline` connects a video source to a bounded `FrameBuffer`. When the queue fills, the oldest queued frame is discarded. This bounds memory and backlog; it does not guarantee zero latency. Queue capacity and inference speed determine how stale a processed frame can be.

Detector-specific results are converted into typed detections. Runtime bounding boxes use pixel `x1, y1, x2, y2` coordinates. `ByteTrackTracker` associates detections across frames using Kalman prediction and matching, with bounded track history.

Zones and virtual lines are persisted in normalized `[0, 1]` coordinates. Analytics convert track centers to that coordinate space; rendering converts geometry to frame pixels. Zone transitions, dwell thresholds, line crossings, and occupancy depend on camera/track state rather than counting each detection as a new object.

Rules evaluate analytics state. Event management applies fingerprints, active state, and cooldown semantics. The worker persists resulting events and evidence metadata, writes annotated JPEG snapshots, and publishes notifications.

## Model Registry and Shared Detector Cache

Cameras select their neural vision model dynamically via the `cameras.model_id` field (e.g., standard `coco-yolov8n` vs specialized `vigilai-ppe-v2`). The model registry (`vigilai_api/core/models_registry.py`) defines model metadata, input dimensions, task profiles, and sanitizes sensitive local filesystem weights paths before exposing public REST schemas (`GET /api/v1/models`).

To prevent memory bloat and duplicate thread pool overhead when multiple cameras share the same model, the CV worker (`CameraManager`) maintains a thread-safe singleton detector cache. Both `ONNXDetector` and `YOLODetector` wrap their native inference calls with threading locks, ensuring deterministic concurrent execution across camera threads sharing identical ONNX sessions or PyTorch models.

## Person-Centric Tracking & PPE Safety Compliance

When operating specialized models such as `vigilai-ppe-v2`, detections contain both human subjects and equipment classes (`helmet`, `vest`, `boots`, `gloves`, `goggles`). 

1. **Tracking Isolation:** ByteTrack multi-object tracking is strictly isolated to human subjects (`person`). Non-human equipment items are never assigned independent Kalman filter trajectories, avoiding track ID fragmentation and Kalman filter divergence.
2. **Competitive Anatomical Association:** Frame-level equipment detections are associated to human bounding boxes using geometric containment, horizontal centering penalties, and biological prior regions (head $y \in [0.0, 0.35]$ for helmets/goggles, torso $y \in [0.15, 0.75]$ for safety vests, feet $y \in [0.65, 1.0]$ for work boots). A greedy bipartite assignment ensures no single equipment detection is double-counted across neighboring workers.
3. **Temporal Compliance Smoothing:** Raw frame detections are processed through a persistent rolling window state machine (`TrackPPEHistory`). To eliminate transient flicker caused by motion blur or occlusions, violation confirmation requires:
   - A rolling observation window (default 10 frames).
   - A conservative positive detection ratio ($\ge 0.35$) confirming equipment presence.
   - A minimum temporal persistence threshold (default $\ge 2.0$ seconds) before elevating an unequipped worker to `VIOLATION_CONFIRMED`.
4. **Auto-Resolution:** Active PPE violation events automatically transition to resolved state when the worker equips the required gear or departs the monitored zone. Evidence snapshots capture the worker bounding box, body-part regions, and associated equipment overlays.

## Browser delivery

- REST serves configuration, historical events, and analytics.
- `/api/v1/ws/events` forwards event notifications after checking camera ownership.
- `/api/v1/ws/cameras/{camera_id}/status` delivers camera status.
- `/api/v1/cameras/{camera_id}/stream` serves MJPEG from Redis's recent annotated frame.

The bounding boxes are drawn into the JPEG preview. WebSockets carry event/status JSON; they do not carry the video itself. Redis Pub/Sub is transient, while PostgreSQL is the source for event history.

## Evidence and security

Snapshots are stored as `EVIDENCE_DIR/ev_<event-id>.jpg`. The current implementation writes to a local filesystem; there is no object-storage backend. API and worker containers share evidence and upload volumes.

Authentication uses bcrypt password hashes and JWT cookies. Private camera resources enforce user ownership. RTSP source credentials use Fernet encryption with a configured persistent key. Uploads use server-side paths and validation. These controls are implementation details, not a substitute for a deployment security review.

## Lifecycle and scaling limits

The worker manages separate camera pipelines, limits camera capacity, publishes heartbeats, and stops pipelines on shutdown. Reconnectable sources use retry delays in the pipeline. Physical-device failure behavior still needs testing in the target environment.

The supported deployment shape is a single host and worker. Adding worker replicas requires exclusive camera assignment to prevent duplicate processing. Redis availability, database connectivity, storage capacity, model availability, and source decoding remain operational dependencies.

## Design rationale

Read the [decision records](docs/decisions) for worker separation, backpressure, tracking, transport, and coordinates. [Validation](docs/VALIDATION.md) describes what was actually exercised.
