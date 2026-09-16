from collections import deque

from apps.api.vigilai_api.cv.analytics.line_analytics import LineAnalyzer
from apps.api.vigilai_api.cv.analytics.zone_analytics import ZoneAnalyzer, ZoneTransition
from apps.api.vigilai_api.cv.detection.models import BBox
from apps.api.vigilai_api.cv.events.manager import EventManager
from apps.api.vigilai_api.cv.rules.engine import RuleConfig, RulesEngine
from apps.api.vigilai_api.cv.tracking.models import Track


class TestPipelineIntegration:
    def test_full_pipeline_flow(self):
        # 1. Create mock tracks (simulating output of tracker)
        t = Track(
            track_id=1,
            class_id=0,
            class_name="person",
            bbox=BBox(4, 4, 6, 6),
            confidence=0.9,
            centroid=(5, 5),
            first_seen=1.0,
            last_seen=1.0,
            age=1,
            trajectory=deque([(5, 5)]),
            is_confirmed=True,
        )
        tracks = [t]

        # 3. Set up zones and lines
        zone_analyzer = ZoneAnalyzer()
        zone_analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})

        line_analyzer = LineAnalyzer()

        rule = RuleConfig(
            "r1", "rule1", "zone_entry", True, "high", ["person"], "z1", None, None, 10, None
        )
        rules_engine = RulesEngine()
        rules_engine.set_rules([rule])

        event_manager = EventManager("cam1")

        # 4. Run zone analytics -> get transitions
        zone_events = zone_analyzer.update(tracks, 1.0)

        # 5. Run line analytics
        line_events = line_analyzer.update(tracks, 1.0)

        # 6. Run rules engine
        all_matches = []
        for ze in zone_events:
            all_matches.extend(rules_engine.evaluate_zone_event(ze))
        for le in line_events:
            all_matches.extend(rules_engine.evaluate_line_crossing(le))

        # 7. Run event manager -> get deduplicated events
        final_events = []
        for match in all_matches:
            evt = event_manager.process_rule_match(match)
            if evt:
                final_events.append(evt)

        # 8. Verify
        assert len(zone_events) == 1
        assert zone_events[0].transition == ZoneTransition.ENTER
        assert len(all_matches) == 1
        assert len(final_events) == 1
        assert final_events[0].rule_id == "r1"

    def test_deduplication_end_to_end(self):
        zone_analyzer = ZoneAnalyzer()
        zone_analyzer.set_zones({"z1": [(0, 0), (10, 0), (10, 10), (0, 10)]})

        rule = RuleConfig(
            "r1", "rule1", "zone_entry", True, "high", ["person"], "z1", None, None, 10, None
        )
        rules_engine = RulesEngine()
        rules_engine.set_rules([rule])

        event_manager = EventManager("cam1")

        final_events_count = 0

        for i in range(10):
            # Same track, same position (or slightly moved but still in zone)
            t = Track(
                track_id=1,
                class_id=0,
                class_name="person",
                bbox=BBox(4, 4, 6, 6),
                confidence=0.9,
                centroid=(5, 5),
                first_seen=1.0,
                last_seen=1.0 + i * 0.1,
                age=1 + i,
                trajectory=deque([(5, 5)]),
                is_confirmed=True,
            )
            tracks = [t]

            zone_events = zone_analyzer.update(tracks, 1.0 + i * 0.1)

            for ze in zone_events:
                matches = rules_engine.evaluate_zone_event(ze)
                for m in matches:
                    evt = event_manager.process_rule_match(m)
                    if evt:
                        final_events_count += 1

        # Expect exactly 1 event because it enters once and stays
        assert final_events_count == 1
