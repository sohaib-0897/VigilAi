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
