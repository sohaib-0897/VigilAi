# 002. Frame Backpressure

**Status:** Accepted

**Context:** 
Video streams produce frames at a constant rate (e.g., 30 FPS). If the CV worker pipeline takes 50ms per frame (20 FPS max), a naive unbounded queue would grow indefinitely, leading to massive memory consumption and ever-increasing latency ("lag" behind real-time reality).

**Decision:** 
We implement a bounded queue for frame ingestion with a strict drop-oldest policy. If the detection pipeline cannot keep up with the RTSP frame rate, the queue will discard intermediate frames.

**Consequences:**
- Strict cap on maximum memory usage per stream.
- Bounded backlog; actual frame age still depends on queue capacity and processing speed.
- Decreased tracking accuracy if too many frames are dropped (objects jump too far between processed frames for the tracker to correlate).
