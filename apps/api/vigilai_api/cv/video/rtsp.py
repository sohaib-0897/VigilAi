import logging
import re
import threading

import cv2
import numpy as np

from .base import VideoMetadata, VideoSource

logger = logging.getLogger(__name__)


class RTSPSource(VideoSource):
    def __init__(self, rtsp_uri: str, max_reconnect_attempts: int = -1):
        self._rtsp_uri = rtsp_uri
        self._max_reconnect_attempts = max_reconnect_attempts
        self._cap = None
        self._lock = threading.Lock()
        self._metadata = None

    def _sanitize_uri(self, uri: str) -> str:
        return re.sub(r"rtsp://(.*):(.*)@", "rtsp://***:***@", uri)

    def open(self) -> bool:
        with self._lock:
            self._cap = cv2.VideoCapture(
                self._rtsp_uri,
                cv2.CAP_FFMPEG,
                [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000],
            )
            if not self._cap.isOpened():
                logger.error(f"Failed to open RTSP stream: {self._sanitize_uri(self._rtsp_uri)}")
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
            if not ret:
                return False, None
            return True, frame

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
        return "rtsp"

    @property
    def source_uri(self) -> str:
        return self._sanitize_uri(self._rtsp_uri)
