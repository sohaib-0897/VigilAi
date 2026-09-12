from collections import deque

import pytest

from apps.api.vigilai_api.cv.detection.models import BBox, Detection
from apps.api.vigilai_api.cv.tracking.models import Track


@pytest.fixture
def sample_polygon():
    # Square from (0,0) to (1,1)
    return [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]


@pytest.fixture
def sample_bbox():
    return BBox(x1=10, y1=10, x2=50, y2=50)


@pytest.fixture
def sample_detections(sample_bbox):
    return [Detection(class_id=0, class_name="person", confidence=0.9, bbox=sample_bbox)]


@pytest.fixture
def sample_tracks(sample_bbox):
    return [
        Track(
            track_id=1,
            class_id=0,
            class_name="person",
            bbox=sample_bbox,
            confidence=0.9,
            centroid=(30.0, 30.0),
            first_seen=1.0,
            last_seen=1.0,
            age=1,
            trajectory=deque([(30.0, 30.0)]),
            is_confirmed=True,
        )
    ]
