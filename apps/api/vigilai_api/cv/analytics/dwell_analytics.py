from dataclasses import dataclass


@dataclass
class DwellAlert:
    zone_id: str
    track_id: int
    object_class: str
    dwell_time: float
    threshold: float
    timestamp: float


class DwellState:
    def __init__(self, track_id: int, zone_id: str, obj_class: str, entered_at: float):
        self.track_id = track_id
        self.zone_id = zone_id
        self.object_class = obj_class
        self.entered_at = entered_at
        self.alerted = False


class DwellAnalyzer:
    def __init__(self):
        self._dwell_states: dict[tuple[int, str], DwellState] = {}
        self._thresholds: dict[str, float] = {}

    def set_thresholds(self, thresholds: dict[str, float]) -> None:
        self._thresholds = thresholds

    def on_zone_enter(
        self, track_id: int, zone_id: str, object_class: str, timestamp: float
    ) -> None:
        self._dwell_states[(track_id, zone_id)] = DwellState(
            track_id, zone_id, object_class, timestamp
        )

    def on_zone_exit(self, track_id: int, zone_id: str, timestamp: float) -> None:
        self._dwell_states.pop((track_id, zone_id), None)

    def check_thresholds(self, timestamp: float) -> list[DwellAlert]:
        alerts = []
        for (track_id, zone_id), state in self._dwell_states.items():
            if not state.alerted and zone_id in self._thresholds:
                dwell = timestamp - state.entered_at
                if dwell >= self._thresholds[zone_id]:
                    state.alerted = True
                    alerts.append(
                        DwellAlert(
                            zone_id=zone_id,
                            track_id=track_id,
                            object_class=state.object_class,
                            dwell_time=dwell,
                            threshold=self._thresholds[zone_id],
                            timestamp=timestamp,
                        )
                    )
        return alerts

    def cleanup_stale(self, active_track_ids: set[int]) -> None:
        stale = [k for k in self._dwell_states if k[0] not in active_track_ids]
        for k in stale:
            del self._dwell_states[k]
