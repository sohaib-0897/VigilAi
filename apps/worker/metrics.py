import threading
import time
from collections import deque


class PipelineMetrics:
    """Thread-safe pipeline metrics."""

    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self._lock = threading.RLock()
        self.frames_received = 0
        self.frames_processed = 0
        self.frames_dropped = 0
        self.total_detections = 0
        self.total_events = 0
        self.inference_times: deque = deque(maxlen=100)
        self.pipeline_errors = 0
        self.start_time = time.time()
        self._last_processed_time = time.time()
        self._fps = 0.0

    def record_frame_received(self):
        with self._lock:
            self.frames_received += 1

    def record_frame_processed(self):
        with self._lock:
            self.frames_processed += 1
            current = time.time()
            elapsed = current - self._last_processed_time
            if elapsed > 0:
                self._fps = 0.1 * (1.0 / elapsed) + 0.9 * self._fps
            self._last_processed_time = current

    def record_frame_dropped(self):
        with self._lock:
            self.frames_dropped += 1

    def record_inference_time(self, ms: float):
        with self._lock:
            self.inference_times.append(ms)

    def record_detection(self, count: int):
        with self._lock:
            self.total_detections += count

    def record_event(self):
        with self._lock:
            self.total_events += 1

    def record_error(self):
        with self._lock:
            self.pipeline_errors += 1

    @property
    def fps(self) -> float:
        with self._lock:
            return self._fps

    @property
    def avg_inference_ms(self) -> float:
        with self._lock:
            if not self.inference_times:
                return 0.0
            return sum(self.inference_times) / len(self.inference_times)

    @property
    def p95_inference_ms(self) -> float:
        with self._lock:
            if not self.inference_times:
                return 0.0
            sorted_times = sorted(self.inference_times)
            idx = int(len(sorted_times) * 0.95)
            return sorted_times[idx]

    def to_dict(self) -> dict:
        with self._lock:
            return {
                "camera_id": self.camera_id,
                "uptime": time.time() - self.start_time,
                "frames_received": self.frames_received,
                "frames_processed": self.frames_processed,
                "frames_dropped": self.frames_dropped,
                "fps": self._fps,
                "avg_inference_ms": self.avg_inference_ms,
                "p95_inference_ms": self.p95_inference_ms,
                "total_events": self.total_events,
                "pipeline_errors": self.pipeline_errors,
            }
