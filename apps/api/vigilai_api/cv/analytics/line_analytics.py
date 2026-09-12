from dataclasses import dataclass

from ..geometry.core import detect_line_crossing, line_side
from ..tracking.models import Track


@dataclass
class LineCrossEvent:
    line_id: str
    track_id: int
    direction: str
    object_class: str
    timestamp: float


class LineAnalyzer:
    def __init__(self):
        self._lines: dict[str, tuple[tuple[float, float], tuple[float, float], str]] = {}
        self._track_last_side: dict[tuple[int, str], float] = {}
        self._crossing_counts: dict[str, dict[str, int]] = {}

    def set_lines(self, lines: dict[str, tuple]) -> None:
        self._track_last_side.clear()
        self._lines = lines
        for l_id in lines:
            if l_id not in self._crossing_counts:
                self._crossing_counts[l_id] = {"a_to_b": 0, "b_to_a": 0}

    def update(self, tracks: list[Track], timestamp: float) -> list[LineCrossEvent]:
        events = []
        for track in tracks:
            if len(track.trajectory) < 2:
                continue

            curr_pt = track.trajectory[-1]
            prev_pt = track.trajectory[-2]

            for line_id, (start, end, mode) in self._lines.items():
                key = (track.track_id, line_id)
                prev_pt = self._track_last_side.get(key, prev_pt)
                if abs(line_side(curr_pt, start, end)) < 1e-9:
                    continue
                self._track_last_side[key] = curr_pt
                crossed, direction = detect_line_crossing(prev_pt, curr_pt, start, end)
                if crossed:
                    if mode in ["both", direction]:
                        self._crossing_counts[line_id][direction] += 1
                        events.append(
                            LineCrossEvent(
                                line_id=line_id,
                                track_id=track.track_id,
                                direction=direction,
                                object_class=track.class_name,
                                timestamp=timestamp,
                            )
                        )
        return events

    def get_counts(self, line_id: str) -> dict[str, int]:
        return self._crossing_counts.get(line_id, {"a_to_b": 0, "b_to_a": 0})

    def cleanup_stale_tracks(self, active_track_ids: set[int]) -> None:
        self._track_last_side = {
            key: value for key, value in self._track_last_side.items() if key[0] in active_track_ids
        }
