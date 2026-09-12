from .base import VideoSource
from .local import LocalVideoSource
from .rtsp import RTSPSource
from .webcam import WebcamSource


class VideoSourceFactory:
    @staticmethod
    def create(source_type: str, uri: str, **kwargs) -> VideoSource:
        source_type = source_type.lower()
        if source_type in ("local", "local_video"):
            return LocalVideoSource(uri, loop=kwargs.get("loop", False))
        elif source_type == "webcam":
            return WebcamSource(int(uri))
        elif source_type == "rtsp":
            return RTSPSource(uri, max_reconnect_attempts=kwargs.get("max_reconnect_attempts", -1))
        else:
            raise ValueError(f"Unknown video source type: {source_type}")
