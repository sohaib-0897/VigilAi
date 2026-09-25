import hashlib
import uuid
from dataclasses import dataclass

import numpy as np

from ..rules.engine import RuleMatch


@dataclass
class EventRecord:
    event_id: str
    rule_id: str
    event_type: str
    severity: str
    camera_id: str
    track_id: int | None
    object_class: str | None
    zone_id: str | None
    line_id: str | None
    fingerprint: str
    started_at: float
    ended_at: float | None
    metadata: dict
    status: str
    evidence_frame: np.ndarray | None


class EventManager:
    def __init__(self, camera_id: str):
        self._camera_id = camera_id
        self._active_events: dict[str, EventRecord] = {}
        self._cooldowns: dict[str, float] = {}

    def _generate_fingerprint(
        self,
        rule_id: str,
        track_id: int | None,
        event_type: str,
        zone_id: str | None = None,
        line_id: str | None = None,
    ) -> str:
        s = f"{rule_id}_{track_id}_{event_type}_{zone_id}_{line_id}"
        return hashlib.md5(s.encode()).hexdigest()

    def process_rule_match(
        self, match: RuleMatch, frame: np.ndarray | None = None
    ) -> EventRecord | None:
        fingerprint = self._generate_fingerprint(
            match.rule.rule_id, match.track_id, match.event_type, match.zone_id, match.line_id
        )

        if fingerprint in self._cooldowns:
            if match.timestamp < self._cooldowns[fingerprint]:
                return None

        if fingerprint in self._active_events:
            return None

        evt = EventRecord(
            event_id=str(uuid.uuid4()),
            rule_id=match.rule.rule_id,
            event_type=match.event_type,
            severity=match.rule.severity,
            camera_id=self._camera_id,
            track_id=match.track_id,
            object_class=match.object_class,
            zone_id=match.zone_id,
            line_id=match.line_id,
            fingerprint=fingerprint,
            started_at=match.timestamp,
            ended_at=None,
            metadata=match.details,
            status="active",
            evidence_frame=frame.copy() if frame is not None else None,
        )

        self._active_events[fingerprint] = evt
        self._cooldowns[fingerprint] = match.timestamp + match.rule.cooldown_seconds
        return evt

    def resolve_event(self, fingerprint: str, timestamp: float) -> EventRecord | None:
        if fingerprint in self._active_events:
            evt = self._active_events.pop(fingerprint)
            evt.status = "resolved"
            evt.ended_at = timestamp
            return evt
        return None

    def check_expired_events(
        self, active_track_ids: set[int], timestamp: float
    ) -> list[EventRecord]:
        self._cooldowns = {fp: until for fp, until in self._cooldowns.items() if until > timestamp}
        resolved = []
        to_del = []
        for fp, evt in self._active_events.items():
            if evt.track_id is not None and evt.track_id not in active_track_ids:
                evt.status = "resolved"
                evt.ended_at = timestamp
                resolved.append(evt)
                to_del.append(fp)

        for fp in to_del:
            del self._active_events[fp]

        return resolved

    def get_active_events(self) -> list[EventRecord]:
        return list(self._active_events.values())

    def reset(self) -> None:
        self._active_events.clear()
        self._cooldowns.clear()

    def end_all_events(self, timestamp: float) -> list[EventRecord]:
        """Resolve every active event when a video replay ends its current pass."""
        ended = list(self._active_events.values())
        for event in ended:
            event.status = "resolved"
            event.ended_at = timestamp
        self.reset()
        return ended
