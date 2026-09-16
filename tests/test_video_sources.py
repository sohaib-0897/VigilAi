from unittest.mock import MagicMock, patch
import pytest
import numpy as np

from vigilai_api.cv.video.factory import VideoSourceFactory
from vigilai_api.cv.video.local import LocalVideoSource
from vigilai_api.cv.video.rtsp import RTSPSource
from vigilai_api.cv.video.webcam import WebcamSource


def test_video_source_factory_local():
    source = VideoSourceFactory.create("local_video", "test.mp4", loop=True)
    assert isinstance(source, LocalVideoSource)
    assert source.source_type == "local"
    assert source.source_uri == "test.mp4"
    assert source._loop is True


def test_video_source_factory_webcam_parsing():
    # Empty string defaults to device 0
    source1 = VideoSourceFactory.create("webcam", "")
    assert isinstance(source1, WebcamSource)
    assert source1._device_index == 0

    # Numeric string parses to integer
    source2 = VideoSourceFactory.create("webcam", "2")
    assert isinstance(source2, WebcamSource)
    assert source2._device_index == 2

    # Integer directly passes through
    source3 = VideoSourceFactory.create("webcam", 1)
    assert isinstance(source3, WebcamSource)
    assert source3._device_index == 1

    # Non-numeric string defaults safely to 0
    source4 = VideoSourceFactory.create("webcam", "default")
    assert isinstance(source4, WebcamSource)
    assert source4._device_index == 0


def test_video_source_factory_rtsp_and_credential_sanitization():
    source = VideoSourceFactory.create("rtsp", "  rtsp://admin:secretPass123@192.168.1.10:554/live  ", max_reconnect_attempts=5)
    assert isinstance(source, RTSPSource)
    assert source.source_type == "rtsp"
    # Never expose credentials in source_uri
    assert source.source_uri == "rtsp://***:***@192.168.1.10:554/live"
    assert "secretPass123" not in source.source_uri
    assert source._max_reconnect_attempts == 5


def test_video_source_factory_invalid_type():
    with pytest.raises(ValueError, match="Unknown video source type"):
        VideoSourceFactory.create("unknown_stream", "http://fake.stream")


def test_rtsp_reconnect_backoff_formula():
    def get_backoff(failures: int) -> int:
        return min(2 ** min(failures, 5), 30)

    assert get_backoff(0) == 1
    assert get_backoff(1) == 2
    assert get_backoff(2) == 4
    assert get_backoff(3) == 8
    assert get_backoff(4) == 16
    assert get_backoff(5) == 30  # 2^5=32 capped at 30
    assert get_backoff(10) == 30  # capped at 30


def test_webcam_lifecycle_mocked():
    source = WebcamSource(device_index=0)
    assert source.source_type == "webcam"
    assert source.source_uri == "0"
    assert not source.is_open()

    with patch("cv2.VideoCapture") as mock_cap_cls:
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: 640.0 if prop == 3 else (480.0 if prop == 4 else 30.0)
        mock_cap.read.return_value = (True, np.zeros((480, 640, 3), dtype=np.uint8))
        mock_cap_cls.return_value = mock_cap

        assert source.open() is True
        assert source.is_open() is True
        assert source.metadata().width == 640
        assert source.metadata().height == 480
        assert source.metadata().fps == 30.0

        ret, frame = source.read()
        assert ret is True
        assert frame is not None
        assert frame.shape == (480, 640, 3)

        source.close()
        assert not source.is_open()
