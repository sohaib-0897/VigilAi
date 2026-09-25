from dataclasses import dataclass
from typing import Any

from ..analytics.dwell_analytics import DwellAlert
from ..analytics.line_analytics import LineCrossEvent
from ..analytics.zone_analytics import ZoneEvent, ZoneTransition


@dataclass
class RuleConfig:
    rule_id: str
    name: str
    rule_type: str
    enabled: bool
    severity: str
    object_classes: list[str] | None
    zone_id: str | None
    line_id: str | None
    threshold_value: float | None
    cooldown_seconds: int
    configuration: dict | None


@dataclass
class RuleMatch:
    rule: RuleConfig
    event_type: str
    track_id: int | None
    object_class: str | None
    zone_id: str | None
    line_id: str | None
    details: dict
    timestamp: float


class RulesEngine:
    def __init__(self):
        self._rules: list[RuleConfig] = []

    def set_rules(self, rules: list[RuleConfig]) -> None:
        self._rules = rules

    def evaluate_zone_event(self, event: ZoneEvent) -> list[RuleMatch]:
        matches = []
        for r in self._rules:
            if not r.enabled:
                continue
            if r.rule_type == "zone_entry" and event.transition == ZoneTransition.ENTER:
                if r.zone_id == event.zone_id and (
                    not r.object_classes or event.object_class in r.object_classes
                ):
                    matches.append(
                        RuleMatch(
                            r,
                            "zone_entry",
                            event.track_id,
                            event.object_class,
                            event.zone_id,
                            None,
                            {},
                            event.timestamp,
                        )
                    )
            elif r.rule_type == "zone_exit" and event.transition == ZoneTransition.EXIT:
                if r.zone_id == event.zone_id and (
                    not r.object_classes or event.object_class in r.object_classes
                ):
                    matches.append(
                        RuleMatch(
                            r,
                            "zone_exit",
                            event.track_id,
                            event.object_class,
                            event.zone_id,
                            None,
                            {"dwell_time": event.dwell_time},
                            event.timestamp,
                        )
                    )
        return matches

    def evaluate_dwell_alert(self, alert: DwellAlert) -> list[RuleMatch]:
        matches = []
        for r in self._rules:
            if r.enabled and r.rule_type == "dwell_time" and r.zone_id == alert.zone_id:
                if (r.threshold_value is not None and alert.dwell_time >= r.threshold_value) and (
                    not r.object_classes or alert.object_class in r.object_classes
                ):
                    matches.append(
                        RuleMatch(
                            r,
                            "dwell_time",
                            alert.track_id,
                            alert.object_class,
                            alert.zone_id,
                            None,
                            {"dwell_time": alert.dwell_time},
                            alert.timestamp,
                        )
                    )
        return matches

    def evaluate_line_crossing(self, event: LineCrossEvent) -> list[RuleMatch]:
        matches = []
        for r in self._rules:
            if r.enabled and r.rule_type == "line_crossing" and r.line_id == event.line_id:
                if not r.object_classes or event.object_class in r.object_classes:
                    matches.append(
                        RuleMatch(
                            r,
                            "line_crossing",
                            event.track_id,
                            event.object_class,
                            None,
                            event.line_id,
                            {"direction": event.direction},
                            event.timestamp,
                        )
                    )
        return matches

    def evaluate_occupancy(self, zone_id: str, occupancy: int) -> list[RuleMatch]:
        matches = []
        import time

        t = time.time()
        for r in self._rules:
            if r.enabled and r.rule_type == "occupancy_threshold" and r.zone_id == zone_id:
                if r.threshold_value is not None and occupancy >= r.threshold_value:
                    matches.append(
                        RuleMatch(
                            r,
                            "occupancy_threshold",
                            None,
                            None,
                            zone_id,
                            None,
                            {"occupancy": occupancy},
                            t,
                        )
                    )
        return matches

    def evaluate_class_presence(self, tracks: list, zone_id: str | None = None) -> list[RuleMatch]:
        matches = []
        import time

        t = time.time()
        present = set([tr.class_name for tr in tracks])
        for r in self._rules:
            if r.enabled and r.rule_type == "class_presence":
                if r.zone_id == zone_id:
                    if r.object_classes and any(c in present for c in r.object_classes):
                        matches.append(
                            RuleMatch(
                                r,
                                "class_presence",
                                None,
                                None,
                                zone_id,
                                None,
                                {"classes": list(present)},
                                t,
                            )
                        )
        return matches

    def evaluate_ppe_alert(self, alert: Any) -> list[RuleMatch]:
        matches = []
        for r in self._rules:
            if not r.enabled or r.rule_type != "ppe_violation":
                continue
            if r.rule_id == alert.rule_id or (
                not alert.rule_id and (r.zone_id is None or r.zone_id == alert.zone_id)
            ):
                details = (
                    alert.to_event_details()
                    if hasattr(alert, "to_event_details")
                    else {
                        "track_id": alert.track_id,
                        "zone_id": alert.zone_id,
                        "missing_ppe": getattr(alert, "missing_ppe", []),
                        "observed_ppe": getattr(alert, "observed_ppe", []),
                    }
                )
                matches.append(
                    RuleMatch(
                        rule=r,
                        event_type="ppe_violation",
                        track_id=alert.track_id,
                        object_class="person",
                        zone_id=alert.zone_id,
                        line_id=None,
                        details=details,
                        timestamp=alert.timestamp,
                    )
                )
        return matches
