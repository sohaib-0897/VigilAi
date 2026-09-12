from collections import deque

import pytest

from apps.api.vigilai_api.cv.analytics.dwell_analytics import DwellAlert
from apps.api.vigilai_api.cv.analytics.line_analytics import LineCrossEvent
from apps.api.vigilai_api.cv.analytics.zone_analytics import ZoneEvent, ZoneTransition
from apps.api.vigilai_api.cv.detection.models import BBox
from apps.api.vigilai_api.cv.rules.engine import RuleConfig, RulesEngine
from apps.api.vigilai_api.cv.tracking.models import Track


@pytest.fixture
def base_rule():
    return RuleConfig(
        rule_id="r1",
        name="test rule",
        rule_type="zone_entry",
        enabled=True,
        severity="high",
        object_classes=["person"],
        zone_id="z1",
        line_id=None,
        threshold_value=None,
        cooldown_seconds=0,
        configuration=None,
    )


class TestRulesEngine:
    def test_zone_entry_rule_matches(self, base_rule):
        engine = RulesEngine()
        engine.set_rules([base_rule])
        event = ZoneEvent(
            zone_id="z1",
            track_id=1,
            transition=ZoneTransition.ENTER,
            object_class="person",
            timestamp=1.0,
            dwell_time=None,
        )
        matches = engine.evaluate_zone_event(event)
        assert len(matches) == 1
        assert matches[0].rule.rule_id == "r1"

    def test_zone_entry_wrong_class_no_match(self, base_rule):
        engine = RulesEngine()
        engine.set_rules([base_rule])
        event = ZoneEvent(
            zone_id="z1",
            track_id=1,
            transition=ZoneTransition.ENTER,
            object_class="car",
            timestamp=1.0,
            dwell_time=None,
        )
        matches = engine.evaluate_zone_event(event)
        assert len(matches) == 0

    def test_disabled_rule_no_match(self, base_rule):
        base_rule.enabled = False
        engine = RulesEngine()
        engine.set_rules([base_rule])
        event = ZoneEvent(
            zone_id="z1",
            track_id=1,
            transition=ZoneTransition.ENTER,
            object_class="person",
            timestamp=1.0,
            dwell_time=None,
        )
        matches = engine.evaluate_zone_event(event)
        assert len(matches) == 0

    def test_dwell_rule_matches(self, base_rule):
        base_rule.rule_type = "dwell_time"
        base_rule.threshold_value = 5.0
        engine = RulesEngine()
        engine.set_rules([base_rule])
        alert = DwellAlert(
            zone_id="z1",
            track_id=1,
            object_class="person",
            dwell_time=10.0,
            threshold=5.0,
            timestamp=1.0,
        )
        matches = engine.evaluate_dwell_alert(alert)
        assert len(matches) == 1

    def test_line_crossing_rule_matches(self, base_rule):
        base_rule.rule_type = "line_crossing"
        base_rule.zone_id = None
        base_rule.line_id = "l1"
        engine = RulesEngine()
        engine.set_rules([base_rule])
        event = LineCrossEvent(
            line_id="l1", track_id=1, direction="a_to_b", object_class="person", timestamp=1.0
        )
        matches = engine.evaluate_line_crossing(event)
        assert len(matches) == 1

    def test_occupancy_threshold_exceeded(self, base_rule):
        base_rule.rule_type = "occupancy_threshold"
        base_rule.threshold_value = 5
        engine = RulesEngine()
        engine.set_rules([base_rule])
        matches = engine.evaluate_occupancy("z1", 6)
        assert len(matches) == 1

    def test_occupancy_below_threshold(self, base_rule):
        base_rule.rule_type = "occupancy_threshold"
        base_rule.threshold_value = 5
        engine = RulesEngine()
        engine.set_rules([base_rule])
        matches = engine.evaluate_occupancy("z1", 3)
        assert len(matches) == 0

    def test_class_presence_rule(self, base_rule):
        base_rule.rule_type = "class_presence"
        engine = RulesEngine()
        engine.set_rules([base_rule])
        tracks = [
            Track(
                track_id=1,
                class_id=0,
                class_name="person",
                bbox=BBox(0, 0, 10, 10),
                confidence=0.9,
                centroid=(5, 5),
                first_seen=1,
                last_seen=1,
                age=1,
                trajectory=deque([(5, 5)]),
                is_confirmed=True,
            )
        ]
        matches = engine.evaluate_class_presence(tracks, "z1")
        assert len(matches) == 1

    def test_multiple_rules_evaluated(self, base_rule):
        rule2 = RuleConfig(
            "r2", "r2", "zone_entry", True, "low", ["person"], "z1", None, None, 0, None
        )
        engine = RulesEngine()
        engine.set_rules([base_rule, rule2])
        event = ZoneEvent(
            zone_id="z1",
            track_id=1,
            transition=ZoneTransition.ENTER,
            object_class="person",
            timestamp=1.0,
            dwell_time=None,
        )
        matches = engine.evaluate_zone_event(event)
        assert len(matches) == 2
