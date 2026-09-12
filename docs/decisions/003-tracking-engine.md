# 003. Tracking Engine

**Status:** Accepted

**Context:** 
Raw object detection identifies objects per frame but does not correlate them across time. To perform analytics like line crossing or dwell time, we need a Multi-Object Tracking (MOT) algorithm.

**Decision:** 
We selected ByteTrack as our primary tracking engine over alternatives like DeepSORT or Norfair.

**Consequences:**
- ByteTrack relies heavily on detector confidence and IoU matching rather than deep feature extraction, making it highly computationally efficient and ideal for real-time edge processing.
- It performs well with occlusion by utilizing low-confidence detection boxes.
- Lack of visual feature matching means cross-camera re-identification is not natively supported by this specific tracker.
