import numpy as np
import pytest
from vigilai_api.cv.detection.models import BBox, Detection
from vigilai_api.cv.geometry.core import validate_polygon
from vigilai_api.cv.tracking.byte_tracker import ByteTrackTracker

from apps.worker.frame_buffer import FrameBuffer
from apps.worker.metrics import PipelineMetrics


def detection(confidence=0.9, x=10):
    return Detection(0, "person", confidence, BBox(x, 10, x + 40, 60))


def test_tracker_persistent_id_no_duplicate_growth():
    tracker = ByteTrackTracker()
    for _ in range(100):
        result = tracker.update([detection()])
        assert [t.track_id for t in result.tracks] == [1]
    assert tracker.total_tracks_created == 1
    assert len(result.tracks[0].trajectory) <= 100


def test_low_confidence_association_and_reappearance():
    tracker = ByteTrackTracker()
    tracker.update([detection()])
    assert [t.track_id for t in tracker.update([detection(0.2)]).tracks] == [1]
    assert tracker.update([]).tracks == []
    assert [t.track_id for t in tracker.update([detection()]).tracks] == [1]
    assert ByteTrackTracker().update([detection()]).tracks[0].track_id == 1


def test_metrics_snapshot_does_not_deadlock():
    import concurrent.futures

    pool = concurrent.futures.ThreadPoolExecutor()
    try:
        stats = pool.submit(PipelineMetrics("camera").to_dict).result(timeout=1)
        assert stats["frames_processed"] == 0
    finally:
        pool.shutdown(wait=False)


def test_frame_buffer_bounded_drops_oldest():
    frame = np.zeros((2, 2, 3), dtype=np.uint8)
    buffer = FrameBuffer(2)
    for t in range(10):
        buffer.put(frame, t)
    assert buffer.stats["frames_dropped"] == 8
    assert buffer.get()[1:] == (8, 0)
    with pytest.raises(ValueError):
        FrameBuffer(0)


@pytest.mark.parametrize(
    "points",
    [[(0, 0), (1, 1), (0, 1), (1, 0)], [(0, 0), (0, 0), (1, 1)], [(0, 0), (0.5, 0.5), (1, 1)]],
)
def test_invalid_polygons(points):
    assert not validate_polygon(points)


def test_real_tracker_to_zone_rule_event_and_snapshot(tmp_path):
    from dataclasses import replace

    from vigilai_api.cv.analytics.zone_analytics import ZoneAnalyzer
    from vigilai_api.cv.events.manager import EventManager
    from vigilai_api.cv.evidence.capture import EvidenceCapture
    from vigilai_api.cv.rules.engine import RuleConfig, RulesEngine

    tracker = ByteTrackTracker()
    zones = ZoneAnalyzer()
    polygon = [(0, 0), (1, 0), (1, 1), (0, 1)]
    zones.set_zones({"zone": polygon})
    rules = RulesEngine()
    rules.set_rules(
        [
            RuleConfig(
                "rule", "entry", "zone_entry", True, "high", None, "zone", None, None, 30, None
            )
        ]
    )
    events = EventManager("camera")
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    generated = []
    for t in range(20):
        tracks = tracker.update([detection()]).tracks
        normalized = [
            replace(tr, centroid=(tr.centroid[0] / 100, tr.centroid[1] / 100)) for tr in tracks
        ]
        for transition in zones.update(normalized, t):
            for match in rules.evaluate_zone_event(transition):
                event = events.process_rule_match(match, frame)
                if event:
                    generated.append(event)
                    metadata = EvidenceCapture(str(tmp_path)).capture_snapshot(
                        frame, event, tracks, {"zone": polygon}
                    )
                    assert metadata.file_size > 0
    assert len(generated) == 1
    assert zones.get_total_occupancy("zone") == 1
    zones.update([], 21)
    assert zones.get_total_occupancy("zone") == 0
