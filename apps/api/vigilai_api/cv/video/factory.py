from .base import VideoSource
from .local import LocalVideoSource
from .rtsp import RTSPSource
from .webcam import WebcamSource


class VideoSourceFactory:
    @staticmethod
    def create(source_type: str, uri: str, **kwargs) -> VideoSource:
        source_type = source_type.strip().lower() if isinstance(source_type, str) else ""
        clean_uri = uri.strip() if isinstance(uri, str) else str(uri or "")

        if source_type in ("local", "local_video"):
            return LocalVideoSource(clean_uri, loop=kwargs.get("loop", False))
        elif source_type == "webcam":
            device_index = 0
            if clean_uri.isdigit():
                device_index = int(clean_uri)
            elif isinstance(uri, int):
                device_index = uri
            return WebcamSource(device_index)
        elif source_type == "rtsp":
            return RTSPSource(clean_uri, max_reconnect_attempts=kwargs.get("max_reconnect_attempts", -1))
        else:
            raise ValueError(f"Unknown video source type: {source_type}")
