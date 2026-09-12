from collections import deque

import pytest

from apps.api.vigilai_api.cv.analytics.dwell_analytics import DwellAnalyzer
from apps.api.vigilai_api.cv.analytics.line_analytics import LineAnalyzer
from apps.api.vigilai_api.cv.analytics.zone_analytics import ZoneAnalyzer, ZoneTransition
from apps.api.vigilai_api.cv.detection.models import BBox
from apps.api.vigilai_api.cv.tracking.models import Track


@pytest.fixture
def make_track():
    def _make_track(track_id, x, y):
        return Track(
            track_id=track_id,
            class_id=0,
            class_name="person",
            bbox=BBox(x1=x - 5, y1=y - 5, x2=x + 5, y2=y + 5),
            confidence=0.9,
            centroid=(x, y),
            first_seen=1.0,
            last_seen=1.0,
            age=1,
            trajectory=deque([(x, y)]),
            is_confirmed=True,
        )

    return _make_track


class TestZoneAnalytics:
    def test_enter_zone(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})
        # Track outside
        events = analyzer.update([make_track(1, -5, -5)], 1.0)
        assert len(events) == 0
        # Track inside
        events = analyzer.update([make_track(1, 5, 5)], 2.0)
        assert len(events) == 1
        assert events[0].transition == ZoneTransition.ENTER
        assert events[0].zone_id == "z1"

    def test_exit_zone(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})
        analyzer.update([make_track(1, 5, 5)], 1.0)  # Enter
        events = analyzer.update([make_track(1, 15, 15)], 2.0)  # Exit
        assert len(events) == 1
        assert events[0].transition == ZoneTransition.EXIT

    def test_remain_in_zone(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})
        analyzer.update([make_track(1, 5, 5)], 1.0)
        events = analyzer.update([make_track(1, 6, 6)], 2.0)
        assert len(events) == 0

    def test_remain_outside_zone(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})
        analyzer.update([make_track(1, -5, -5)], 1.0)
        events = analyzer.update([make_track(1, -6, -6)], 2.0)
        assert len(events) == 0

    def test_track_disappears(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})
        analyzer.update([make_track(1, 5, 5)], 1.0)
        events = analyzer.cleanup_stale_tracks(set(), 2.0)
        assert len(events) == 1
        assert events[0].transition == ZoneTransition.EXIT

    def test_multiple_zones(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones(
            {
                "z1": [(0, 0), (10, 0), (10, 10), (0, 10)],
                "z2": [(20, 20), (30, 20), (30, 30), (20, 30)],
            }
        )
        events = analyzer.update([make_track(1, 5, 5), make_track(2, 25, 25)], 1.0)
        assert len(events) == 2

    def test_occupancy_count(self, make_track):
        analyzer = ZoneAnalyzer()
        analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})
        analyzer.update([make_track(1, 5, 5), make_track(2, 6, 6)], 1.0)
        assert analyzer.get_total_occupancy("z1") == 2
        assert analyzer.get_occupancy("z1").get("person") == 2


class TestLineAnalytics:
    @pytest.fixture
    def make_track_trajectory(self, make_track):
        def _make(t_id, p1, p2):
            t = make_track(t_id, p2[0], p2[1])
            t.trajectory.clear()
            t.trajectory.append(p1)
            t.trajectory.append(p2)
            return t

        return _make

    def test_cross_line(self, make_track_trajectory):
        analyzer = LineAnalyzer()
        analyzer.set_lines({"l1": ((0, 0), (0, 10), "both")})
        events = analyzer.update([make_track_trajectory(1, (-5, 5), (5, 5))], 1.0)
        assert len(events) == 1
        assert events[0].line_id == "l1"

    def test_no_crossing_same_side(self, make_track_trajectory):
        analyzer = LineAnalyzer()
        analyzer.set_lines({"l1": ((0, 0), (0, 10), "both")})
        events = analyzer.update([make_track_trajectory(1, (-5, 5), (-2, 5))], 1.0)
        assert len(events) == 0

    def test_direction_a_to_b(self, make_track_trajectory):
        analyzer = LineAnalyzer()
        analyzer.set_lines({"l1": ((0, 0), (0, 10), "a_to_b")})
        events = analyzer.update([make_track_trajectory(1, (-5, 5), (5, 5))], 1.0)
        assert len(events) == 1
        assert events[0].direction == "a_to_b"

    def test_direction_b_to_a(self, make_track_trajectory):
        analyzer = LineAnalyzer()
        analyzer.set_lines({"l1": ((0, 0), (0, 10), "a_to_b")})
        events = analyzer.update([make_track_trajectory(1, (5, 5), (-5, 5))], 1.0)
        assert len(events) == 0  # because mode is a_to_b, this is b_to_a

        analyzer.set_lines({"l1": ((0, 0), (0, 10), "b_to_a")})
        events = analyzer.update([make_track_trajectory(1, (5, 5), (-5, 5))], 1.0)
        assert len(events) == 1

    def test_single_crossing_not_repeated(self, make_track_trajectory):
        analyzer = LineAnalyzer()
        analyzer.set_lines({"l1": ((0, 0), (0, 10), "both")})
        analyzer.update([make_track_trajectory(1, (-5, 5), (5, 5))], 1.0)
        events = analyzer.update([make_track_trajectory(1, (5, 5), (8, 5))], 2.0)
        assert len(events) == 0

    def test_crossing_counts(self, make_track_trajectory):
        analyzer = LineAnalyzer()
        analyzer.set_lines({"l1": ((0, 0), (0, 10), "both")})
        analyzer.update([make_track_trajectory(1, (-5, 5), (5, 5))], 1.0)
        counts = analyzer.get_counts("l1")
        assert counts["a_to_b"] == 1


class TestDwellAnalytics:
    def test_dwell_threshold_exceeded(self):
        analyzer = DwellAnalyzer()
        analyzer.set_thresholds({"z1": 5.0})
        analyzer.on_zone_enter(1, "z1", "person", 1.0)
        alerts = analyzer.check_thresholds(7.0)
        assert len(alerts) == 1
        assert alerts[0].dwell_time >= 5.0

    def test_dwell_below_threshold(self):
        analyzer = DwellAnalyzer()
        analyzer.set_thresholds({"z1": 5.0})
        analyzer.on_zone_enter(1, "z1", "person", 1.0)
        alerts = analyzer.check_thresholds(3.0)
        assert len(alerts) == 0

    def test_dwell_fires_once(self):
        analyzer = DwellAnalyzer()
        analyzer.set_thresholds({"z1": 5.0})
        analyzer.on_zone_enter(1, "z1", "person", 1.0)
        analyzer.check_thresholds(7.0)  # Fires
        alerts = analyzer.check_thresholds(8.0)  # Should not fire again
        assert len(alerts) == 0

    def test_dwell_exit_resets(self):
        analyzer = DwellAnalyzer()
        analyzer.set_thresholds({"z1": 5.0})
        analyzer.on_zone_enter(1, "z1", "person", 1.0)
        analyzer.on_zone_exit(1, "z1", 3.0)
        alerts = analyzer.check_thresholds(7.0)
        assert len(alerts) == 0
