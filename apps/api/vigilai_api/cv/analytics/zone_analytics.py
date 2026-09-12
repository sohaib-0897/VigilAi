from dataclasses import dataclass
from enum import Enum

from ..geometry.core import point_in_polygon
from ..tracking.models import Track


class ZoneTransition(Enum):
    ENTER = "enter"
    EXIT = "exit"
    NONE = "none"


@dataclass
class ZoneEvent:
    zone_id: str
    track_id: int
    transition: ZoneTransition
    object_class: str
    timestamp: float
    dwell_time: float | None


class ZoneState:
    def __init__(self, track_id: int, zone_id: str):
        self.track_id = track_id
        self.zone_id = zone_id
        self.is_inside = False
        self.entered_at: float | None = None
        self.last_seen: float = 0.0


class ZoneAnalyzer:
    def __init__(self):
        self._zones: dict[str, list[tuple[float, float]]] = {}
        self._track_states: dict[tuple[int, str], ZoneState] = {}
        self._occupancy: dict[str, dict[str, int]] = {}

    def set_zones(self, zones: dict[str, list[tuple[float, float]]]) -> None:
        self._zones = zones
        for z_id in zones:
            if z_id not in self._occupancy:
                self._occupancy[z_id] = {}

    def update(self, tracks: list[Track], timestamp: float) -> list[ZoneEvent]:
        events = []
        current_occupancy = {z: {} for z in self._zones}

        for track in tracks:
            for zone_id, polygon in self._zones.items():
                key = (track.track_id, zone_id)
                state = self._track_states.get(key)
                if not state:
                    state = ZoneState(track.track_id, zone_id)
                    self._track_states[key] = state

                is_inside = point_in_polygon(track.centroid, polygon)

                if is_inside:
                    c_name = track.class_name
                    current_occupancy[zone_id][c_name] = (
                        current_occupancy[zone_id].get(c_name, 0) + 1
                    )

                if is_inside and not state.is_inside:
                    state.is_inside = True
                    state.entered_at = timestamp
                    events.append(
                        ZoneEvent(
                            zone_id=zone_id,
                            track_id=track.track_id,
                            transition=ZoneTransition.ENTER,
                            object_class=track.class_name,
                            timestamp=timestamp,
                            dwell_time=None,
                        )
                    )
                elif not is_inside and state.is_inside:
                    state.is_inside = False
                    dwell = timestamp - state.entered_at if state.entered_at else 0
                    events.append(
                        ZoneEvent(
                            zone_id=zone_id,
                            track_id=track.track_id,
                            transition=ZoneTransition.EXIT,
                            object_class=track.class_name,
                            timestamp=timestamp,
                            dwell_time=dwell,
                        )
                    )
                    state.entered_at = None

                state.last_seen = timestamp

        self._occupancy = current_occupancy
        return events

    def get_occupancy(self, zone_id: str) -> dict[str, int]:
        return self._occupancy.get(zone_id, {})

    def get_total_occupancy(self, zone_id: str) -> int:
        return sum(self._occupancy.get(zone_id, {}).values())

    def cleanup_stale_tracks(self, active_track_ids: set[int], timestamp: float) -> list[ZoneEvent]:
        events = []
        stale_keys = []
        for (track_id, zone_id), state in self._track_states.items():
            if track_id not in active_track_ids:
                if state.is_inside:
                    dwell = timestamp - state.entered_at if state.entered_at else 0
                    events.append(
                        ZoneEvent(
                            zone_id=zone_id,
                            track_id=track_id,
                            transition=ZoneTransition.EXIT,
                            object_class="unknown",
                            timestamp=timestamp,
                            dwell_time=dwell,
                        )
                    )
                stale_keys.append((track_id, zone_id))

        for k in stale_keys:
            del self._track_states[k]

        return events
