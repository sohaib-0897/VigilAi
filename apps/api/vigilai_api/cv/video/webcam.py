import threading

import cv2
import numpy as np

from .base import VideoMetadata, VideoSource


class WebcamSource(VideoSource):
    def __init__(self, device_index: int = 0):
        self._device_index = device_index
        self._cap = None
        self._lock = threading.Lock()
        self._metadata = None

    def open(self) -> bool:
        with self._lock:
            self._cap = cv2.VideoCapture(self._device_index)
            if not self._cap.isOpened():
                return False

            self._metadata = VideoMetadata(
                width=int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                height=int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                fps=float(self._cap.get(cv2.CAP_PROP_FPS)),
                total_frames=-1,
                codec=str(int(self._cap.get(cv2.CAP_PROP_FOURCC))),
            )
            return True

    def read(self) -> tuple[bool, np.ndarray | None]:
        with self._lock:
            if not self.is_open():
                return False, None
            ret, frame = self._cap.read()
            return ret, frame if ret else None

    def is_open(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    def close(self) -> None:
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None

    def reconnect(self) -> bool:
        self.close()
        return self.open()

    def metadata(self) -> VideoMetadata:
        return self._metadata

    @property
    def source_type(self) -> str:
        return "webcam"

    @property
    def source_uri(self) -> str:
        return str(self._device_index)
