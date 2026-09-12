# VigilAI — Agent Instructions

These are persistent repository rules for AI coding agents working on VigilAI.
Treat them as standing instructions. Do not quote or restate them unless asked.

## Mission

Build **VigilAI** as a production-oriented real-time computer vision analytics platform suitable for a serious Computer Vision Engineer / Applied AI Engineer / AI Software Engineer portfolio.

Core product flow:

```text
Video / RTSP / Webcam
→ Decode
→ Bounded frame pipeline
→ YOLO detection
→ Multi-object tracking
→ Zones / lines / dwell / occupancy
→ Rules
→ Stateful event generation
→ Evidence
→ PostgreSQL
→ FastAPI + real-time stream
→ Next.js dashboard
```

The system must demonstrate both strong computer vision engineering and strong production software engineering.

## How to Work

For every task:

1. Inspect relevant code and callers before editing.
2. Search for existing implementations before creating new ones.
3. Make the strongest practical decision without asking routine questions.
4. Implement the requested behavior fully, not just a plan or scaffold.
5. Run focused verification.
6. Fix failures caused by the change.
7. Run broader tests/builds when warranted.
8. Report only what was actually implemented and verified.

Do not stop at planning when implementation is possible.
Do not ask for phase-by-phase approval for normal repository work.
If one optional feature is blocked, document it and continue with unaffected work.

## Truthfulness

Never fake production behavior.

Never fabricate:

- detections
- track IDs
- camera status
- event history
- analytics
- benchmark results
- precision / recall / mAP
- FPS or latency
- CPU/GPU usage
- TensorRT gains

If something cannot be measured, use `NOT_MEASURED`.

Mocks/fakes are allowed in tests for isolation, but they must never replace the real production path.

Never display unsupported frontend functionality as if it works.

## Priorities

When tradeoffs are necessary:

### P0 — must work
- boot/config
- PostgreSQL + migrations
- authentication/authorization
- local video
- YOLO detection
- multi-object tracking
- geometry
- zones
- line crossing
- counting
- dwell detection
- rules
- event deduplication
- event persistence
- evidence snapshots
- worker/API separation
- FastAPI
- live updates
- dashboard
- camera configuration
- events UI
- tests
- Docker
- documentation

### P1 — strongly desired
- RTSP reconnect
- webcam
- multi-camera runtime
- worker health
- observability
- ONNX Runtime
- benchmarking
- training pipeline
- historical analytics

### P2 — environment dependent
- real fine-tuning run
- TensorRT execution
- GPU benchmarks
- event clips

### P3 — optional
- PPE
- LPR
- pose/fall detection
- calibrated speed
- multi-camera re-ID
- Jetson deployment

Never sacrifice P0 reliability for P3 features.

## Preferred Stack

Unless the existing repository gives a strong reason otherwise:

### Backend / CV
- Python 3.12
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x async
- Alembic
- PostgreSQL 16
- Redis only where justified
- PyTorch
- Ultralytics YOLO
- OpenCV
- ByteTrack or BoT-SORT

### Frontend
- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- Recharts
- Lucide

### Infrastructure
- Docker
- Docker Compose

Do not add Kubernetes, Kafka, service mesh, GraphQL, MLflow, CQRS, or other infrastructure merely to look sophisticated.

## Architecture Rules

Long-running video inference must be separate from the HTTP API.

Never implement:

```text
HTTP request
→ process camera forever
```

Inference must not block normal API requests.

Use a bounded video pipeline. If processing is slower than source FPS, prioritize freshness with bounded queues / stale-frame dropping / latest-frame semantics.

Never allow unlimited frame backlog.

Runtime state must be keyed by `camera_id`; do not assume only one camera exists globally.

A failure in one camera should not crash unrelated cameras where isolation is practical.

## Detection

Keep model-specific behavior behind a detector abstraction.

A detection should expose a typed structure containing at least:

- class ID
- class name
- confidence
- bounding box

Define bounding-box format explicitly.

Initial useful classes:
- person
- bicycle
- car
- motorcycle
- bus
- truck

Do not spread raw Ultralytics result handling throughout the codebase.

## Tracking

Detection is not tracking.

Tracking must provide persistent IDs across frames.

Use track identity for:

- unique counts
- line crossing
- zone occupancy
- dwell time
- trajectories
- event deduplication

Never count every detection in every frame as a new object.

Keep trajectory/history bounded.

## Geometry

Keep geometry independent from YOLO/tracker internals.

Core tested behavior should include:

- bbox centroid
- point-in-polygon
- polygon validation
- line-side calculation
- crossing detection
- directional crossing where valid

Persist camera geometry in normalized coordinates when practical:

```text
x ∈ [0,1]
y ∈ [0,1]
```

Convert to frame/display coordinates at runtime.

## Zones, Lines, Dwell

Maintain state per camera and track.

Zone transitions:

```text
outside → inside = ENTER
inside → outside = EXIT
```

Line crossing must use trajectory/state so touching a line for multiple frames does not create repeated crossings.

Dwell state should track entry time and threshold state. A dwell threshold should fire once according to defined lifecycle/cooldown semantics, not every frame.

## Rules and Events

Rules should be persisted/configurable rather than hardcoded entirely inside the video loop.

Core rule types:

- object enters zone
- object exits zone
- dwell threshold
- line crossing
- occupancy threshold
- class presence where useful

Event generation must be stateful and deterministic.

Prevent duplicate alert spam using appropriate combinations of:

- rule ID
- track ID
- trigger identity
- fingerprint
- active state
- cooldown
- resolved/ended state

Critical event semantics require tests.

## Evidence

Important events should preserve reviewable evidence.

Minimum reliable implementation:

- annotated snapshot
- timestamp
- bounding box
- class
- track ID
- relevant zone/line overlay
- event metadata

Use a storage abstraction.

If clips cannot be made reliable, implement snapshots correctly first.
Never keep an unbounded video buffer in memory.

## Database

Use PostgreSQL and real Alembic migrations.

Likely useful entities include:

- User
- Camera
- Zone
- VirtualLine
- AnalyticsRule
- Event
- Evidence
- CameraSession
- TrackSummary
- ModelArtifact

Only add entities with real purpose.

Do not persist every bounding box from every frame by default.
Prefer events and useful summaries.

Use foreign keys, useful indexes, constraints, timestamps, and sensible cascades.
A fresh database must migrate cleanly.

## API

Use a versioned API such as `/api/v1`.

Use:

- typed schemas
- validation
- proper HTTP status codes
- centralized errors
- pagination
- authorization checks

Do not leak stack traces in production responses.
Do not poll aggressively when a real-time channel is appropriate.

## Security

Treat camera infrastructure as security-sensitive.

Required principles:

- never store plaintext passwords
- use a maintained strong password-hashing library
- protect private endpoints
- enforce resource ownership
- never log secrets
- redact RTSP credentials
- do not return raw camera passwords
- validate uploads
- generate safe server-side filenames
- prevent path traversal
- enforce configurable upload limits
- keep secrets in environment variables
- never hardcode production secrets
- configure CORS intentionally
- use secure cookie/token handling appropriate to the architecture

Do not implement custom cryptography.

## Worker Runtime

Worker design must handle:

- start/stop lifecycle
- camera assignment
- cleanup
- stream reconnects
- failures
- bounded queues
- worker health/heartbeat
- graceful shutdown

On shutdown, release capture handles, queues, tasks/threads, writers, and temporary resources.

Do not busy-loop on failed streams.
Use bounded retry/backoff for reconnectable sources.

## Real-Time Frontend

Use WebSocket or SSE according to actual needs.

Use real-time delivery for relevant:

- events
- camera status
- counters
- worker health

Reconnect cleanly.

The UI must look like a professional monitoring product, not a student YOLO demo.

Prioritize:

- camera/live view
- clear hierarchy
- accessible contrast
- responsive layout
- loading/error/empty states
- keyboard/focus accessibility
- real backend data

Avoid fake charts, fake status, dead buttons, decorative complexity, and excessive gradients.

Every meaningful UI control must map to real backend behavior.

## Camera Overlay Editor

Zones and lines should be drawable/editable over the camera/video preview.

Coordinate mapping must remain correct across:

- normalized backend coordinates
- source frame dimensions
- rendered browser dimensions
- scaling / letterboxing when applicable

Do not persist raw mouse pixels as permanent geometry.

## Training / Optimization

Maintain a reproducible training pipeline:

```text
dataset
→ validation
→ train/val/test
→ augmentation
→ training/fine-tuning
→ evaluation
→ export
```

Track real:
- precision
- recall
- mAP@50
- mAP@50-95

If training cannot execute, keep the workflow reproducible and state that it was not executed.

Keep inference backends clean enough for:

- PyTorch
- ONNX Runtime
- optional TensorRT

Do not claim one backend is faster without measurement.
TensorRT must remain optional if unsupported by the machine.

## Benchmarking

Benchmark real execution only.

Where supported, measure:

- warmup runs
- measured runs
- FPS
- mean latency
- p50
- p95
- model size
- CPU memory
- GPU memory when available

Persist measured results to a machine-readable artifact.
Never hand-write invented benchmark numbers.

## Observability

Use structured logs.

Useful context:
- camera ID
- worker ID
- event ID
- operation

Never log credentials.

Useful metrics:
- active cameras
- reconnects
- frames received
- frames processed
- frames dropped
- inference latency
- queue depth
- events generated
- pipeline errors
- worker health

Avoid high-cardinality metric labels such as arbitrary track IDs.

## Testing

Critical logic should be testable without a GPU.

Prioritize tests for:

### Geometry
- point in/out polygon
- line side
- crossing
- directional crossing

### Analytics
- zone enter/exit
- dwell
- occupancy
- track disappearance

### Rules/events
- match/mismatch
- disabled rule
- cooldown
- deduplication
- thresholds

### API
- auth
- camera CRUD
- zones
- lines
- rules
- events
- authorization

### Integration
At least one path approximating:

```text
frames
→ detections
→ tracking
→ analytics
→ rule
→ event
```

## Code Quality

Prefer:

- strong typing
- small coherent modules
- explicit interfaces
- clear names
- deterministic state transitions
- centralized configuration
- dependency injection where it helps testing
- structured errors
- clean shutdown

Avoid:

- god classes
- giant utility files
- circular dependencies
- duplicated business logic
- premature abstractions
- silent exception swallowing
- unnecessary dependencies

Preserve working architecture unless there is a concrete correctness/maintainability reason to refactor it.

## Editing Discipline

Before changing code:

1. inspect the target file
2. inspect callers/interfaces
3. search for existing related logic
4. inspect relevant tests

After changing code:

1. format/lint affected code
2. run focused tests
3. fix regressions
4. run broader build/tests when appropriate
5. update migrations/docs if behavior or persistence changed

Do not rewrite an entire subsystem to fix a small defect unless genuinely necessary.

## Context Efficiency

Use repository context deliberately.

Prefer:

- targeted search before opening files
- tracing callers to implementations
- reading only relevant modules
- concise command output
- batching related edits
- retaining established decisions

Avoid:

- rereading the whole repository for every task
- dumping huge logs
- repeatedly restating these rules
- regenerating unchanged files
- reading vendor/generated directories without need

Normally ignore:

- `node_modules`
- `.next`
- virtual environments
- caches
- build output
- large model weights
- generated evidence/media
- database volumes

## Verification

Never claim success because code merely looks correct.

Prefer executable proof in this order:

1. syntax/import/type checks
2. focused unit tests
3. affected integration tests
4. backend/frontend builds
5. migrations
6. end-to-end smoke test
7. Docker validation when relevant

When a command fails, determine whether the cause is code or environment.
Fix real defects and rerun verification.
Do not hide failing tests.

## Repository Hygiene

Never commit:

- `.env`
- credentials/API keys
- RTSP passwords
- secrets
- `node_modules`
- virtual environments
- generated caches
- unnecessary large videos
- unintended model checkpoints
- evidence output

Maintain `.gitignore`.
Keep `.env.example` secret-free.

## Documentation

Documentation must describe the implementation that actually exists.

Keep relevant files accurate:

- `README.md`
- `ARCHITECTURE.md`
- `OPERATIONS.md`
- setup/migration instructions
- training commands
- benchmark commands

Do not present roadmap features as completed functionality.

## Demo Standard

The core demo should work without physical CCTV hardware:

```text
launch stack
→ authenticate
→ add/upload local video
→ start analytics
→ run detection/tracking
→ display annotated feed
→ create zone/line
→ create rule
→ trigger event
→ persist event
→ capture evidence
→ inspect event
→ view real analytics
```

This vertical workflow is more important than optional advanced features.

## Explicitly Forbidden Misrepresentations

Never:

- call detection "tracking"
- call repeated frame detections unique counts
- treat pixel velocity as real-world vehicle speed
- claim TensorRT optimization without executing TensorRT
- claim model accuracy without evaluation
- call a placeholder feed live
- show random/seeded charts as real analytics
- treat an HTTP request loop as a worker architecture
- use unbounded queues in the real-time pipeline
- report mocked test output as a benchmark

## Definition of Done

A feature is complete only when applicable items are satisfied:

- implementation exists
- interfaces are connected
- errors are handled
- persistence/migration exists if required
- authorization exists if required
- critical tests exist
- UI is connected to real behavior if exposed
- relevant docs are updated
- verification actually ran

A scaffold, TODO, dead control, or mocked production result is not complete.

## Final Reporting

After substantial work, report concisely:

- what changed
- what was verified
- tests/builds that passed
- what could not be verified
- genuine blockers/limitations
- important remaining risks

Do not claim `production-ready` without evidence.

The project should demonstrate that its author understands:

```text
detection != tracking
tracking analytics require state
event detection requires deduplication
real-time video requires backpressure
RTSP requires recovery
inference should not block the API
pixel velocity != calibrated speed
production systems require observability
benchmarks require measurement
AI claims require evidence
```

When uncertain, prefer the implementation that is easiest to defend in a serious technical interview.
