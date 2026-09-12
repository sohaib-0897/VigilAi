# 001. Video Worker Separation

**Status:** Accepted

**Context:** 
Computer vision inference (YOLO) and multi-object tracking are CPU/GPU-intensive blocking operations. Running these tasks within the same async event loop as the FastAPI web server would cause severe latency spikes, degrading the responsiveness of the HTTP API and WebSocket connections.

**Decision:** 
We separate the architecture into two distinct components: a lightweight FastAPI application for handling HTTP/WebSocket traffic, and a separate background worker process for running the video processing pipeline. They communicate asynchronously via PostgreSQL (persistence) and Redis (real-time events/pub-sub).

**Consequences:**
- Improved API stability and response times.
- Ability to scale API and CV workers independently.
- Increased operational complexity (two services to deploy and monitor instead of one).
