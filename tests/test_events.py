import pytest

from apps.api.vigilai_api.cv.events.manager import EventManager
from apps.api.vigilai_api.cv.rules.engine import RuleConfig, RuleMatch


@pytest.fixture
def sample_match():
    rule = RuleConfig(
        "r1", "rule1", "zone_entry", True, "high", ["person"], "z1", None, None, 10, None
    )
    return RuleMatch(rule, "zone_entry", 1, "person", "z1", None, {}, 100.0)


class TestEventManager:
    def test_first_event_created(self, sample_match):
        manager = EventManager("cam1")
        evt = manager.process_rule_match(sample_match)
        assert evt is not None
        assert evt.rule_id == "r1"
        assert evt.track_id == 1

    def test_duplicate_suppressed(self, sample_match):
        manager = EventManager("cam1")
        manager.process_rule_match(sample_match)
        sample_match.timestamp += 1.0
        evt2 = manager.process_rule_match(sample_match)
        assert evt2 is None

    def test_different_track_creates_new_event(self, sample_match):
        manager = EventManager("cam1")
        manager.process_rule_match(sample_match)
        sample_match.track_id = 2
        evt2 = manager.process_rule_match(sample_match)
        assert evt2 is not None

    def test_cooldown_suppresses(self, sample_match):
        manager = EventManager("cam1")
        evt1 = manager.process_rule_match(sample_match)
        assert evt1 is not None

        # Resolve event so it's not active anymore, but still in cooldown
        manager.resolve_event(evt1.fingerprint, 101.0)

        sample_match.timestamp += 5.0  # Cooldown is 10
        evt2 = manager.process_rule_match(sample_match)
        assert evt2 is None

    def test_cooldown_expires_allows_new(self, sample_match):
        manager = EventManager("cam1")
        evt1 = manager.process_rule_match(sample_match)
        assert evt1 is not None

        manager.resolve_event(evt1.fingerprint, 101.0)

        sample_match.timestamp += 15.0  # Past 10s cooldown
        evt2 = manager.process_rule_match(sample_match)
        assert evt2 is not None

    def test_resolve_event(self, sample_match):
        manager = EventManager("cam1")
        evt1 = manager.process_rule_match(sample_match)
        assert evt1.status == "active"

        resolved = manager.resolve_event(evt1.fingerprint, 105.0)
        assert resolved.status == "resolved"
        assert resolved.ended_at == 105.0
        assert len(manager.get_active_events()) == 0

    def test_expired_track_resolves(self, sample_match):
        manager = EventManager("cam1")
        evt1 = manager.process_rule_match(sample_match)
        assert evt1 is not None

        resolved_list = manager.check_expired_events(set([2]), 110.0)
        assert len(resolved_list) == 1
        assert resolved_list[0].status == "resolved"
