# 005. Coordinate System

**Status:** Accepted

**Context:** 
Users configure analytical boundaries (zones, lines) on the frontend video player. Cameras may change resolution over time, or the UI might display the video at a scaled size. Storing absolute pixel coordinates creates brittleness.

**Decision:** 
Persisted zone polygons and virtual lines use normalized coordinates `[0, 1]` relative to frame dimensions. Detector/tracker bounding boxes use pixel `x1, y1, x2, y2` coordinates. Analytics normalize track centers; rendering scales zones and lines to pixels.

**Consequences:**
- Configurations remain valid even if the source camera stream resolution changes.
- The frontend can seamlessly scale drawing overlays to fit any viewport.
- The backend multiplies normalized zone/line coordinates by frame dimensions when rendering evidence; runtime bounding boxes are already in pixels.
