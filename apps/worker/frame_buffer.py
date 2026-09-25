import queue

import numpy as np


class FrameBuffer:
    """Bounded frame buffer with latest-frame semantics.
    When buffer is full, drops oldest frames to maintain freshness."""

    def __init__(self, maxsize: int = 30):
        if maxsize < 1:
            raise ValueError("Frame buffer must be bounded and positive")
        self._queue = queue.Queue(maxsize=maxsize)
        self._frames_received = 0
        self._frames_dropped = 0

    def put(self, frame: np.ndarray, timestamp: float, loop_count: int = 0) -> None:
        """Add frame. If full, drop oldest and add new."""
        self._frames_received += 1
        try:
            self._queue.put_nowait((frame, timestamp, loop_count))
        except queue.Full:
            try:
                self._queue.get_nowait()
                self._frames_dropped += 1
                self._queue.put_nowait((frame, timestamp, loop_count))
            except (queue.Empty, queue.Full):
                pass

    def get(self, timeout: float = 1.0) -> tuple[np.ndarray, float, int] | None:
        """Get next frame with timestamp."""
        try:
            return self._queue.get(timeout=timeout)
        except queue.Empty:
            return None

    @property
    def stats(self) -> dict:
        return {
            "queue_size": self._queue.qsize(),
            "frames_received": self._frames_received,
            "frames_dropped": self._frames_dropped,
        }
