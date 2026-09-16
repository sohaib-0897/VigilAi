import tempfile
from pathlib import Path
import cv2
import pytest

from scripts.demo_setup import generate_synthetic_surveillance_video


def test_synthetic_surveillance_video_generation():
    with tempfile.TemporaryDirectory() as tmpdir:
        out_file = Path(tmpdir) / "test_demo_feed.mp4"
        generated = generate_synthetic_surveillance_video(out_file, num_frames=30)
        assert generated.exists()
        assert generated.stat().st_size > 5000  # Non-trivial MP4 file

        cap = cv2.VideoCapture(str(generated))
        try:
            assert cap.isOpened()
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = float(cap.get(cv2.CAP_PROP_FPS))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            assert width == 640
            assert height == 360
            assert fps == 25.0
            assert total_frames == 30

            ret, frame = cap.read()
            assert ret is True
            assert frame is not None
            assert frame.shape == (360, 640, 3)
        finally:
            cap.release()
