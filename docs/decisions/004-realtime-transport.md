# 004. Real-time Transport

**Status:** Accepted

**Context:** 
The web UI requires real-time telemetry (bounding boxes, events) and a live video feed to overlay the analytics visually.

**Decision:** 
We use WebSockets for event notifications and camera status JSON. Live video uses MJPEG (Motion JPEG) over HTTP, with bounding boxes drawn into the image by the worker. Historical analytics and system metrics use REST.

**Consequences:**
- MJPEG is extremely simple to implement and proxy, requiring no complex STUN/TURN server infrastructure.
- MJPEG consumes significantly higher bandwidth than H.264/WebRTC.
- This is a deliberate trade-off prioritizing development speed and architectural simplicity for MVP over bandwidth efficiency. WebRTC will be evaluated for future roadmap.
