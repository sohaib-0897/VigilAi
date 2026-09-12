from collections import defaultdict
from dataclasses import dataclass

from ..tracking.models import Track
from .line_analytics import LineAnalyzer
from .zone_analytics import ZoneAnalyzer


@dataclass
class CountingState:
    total_unique_tracks: int
    current_object_count: int
    class_counts: dict[str, int]
    zone_occupancy: dict[str, int]
    line_crossings: dict[str, dict[str, int]]


class CountingAnalyzer:
    def __init__(self):
        self._seen_track_ids: set[int] = set()
        self._class_track_ids: dict[str, set[int]] = defaultdict(set)
        self._highest_id = 0
        self._total_unique = 0
        self._class_totals: dict[str, int] = defaultdict(int)

    def update(
        self, tracks: list[Track], zone_analyzer: ZoneAnalyzer, line_analyzer: LineAnalyzer
    ) -> CountingState:
        for t in sorted(tracks, key=lambda t: t.track_id):
            if t.track_id > self._highest_id:
                self._highest_id = t.track_id
                self._total_unique += 1
                self._class_totals[t.class_name] += 1

        class_counts = dict(self._class_totals)

        zone_occupancy = {z: zone_analyzer.get_total_occupancy(z) for z in zone_analyzer._zones}
        line_crossings = {l: line_analyzer.get_counts(l) for l in line_analyzer._lines}

        return CountingState(
            total_unique_tracks=self._total_unique,
            current_object_count=len(tracks),
            class_counts=class_counts,
            zone_occupancy=zone_occupancy,
            line_crossings=line_crossings,
        )

    def reset(self) -> None:
        self._seen_track_ids.clear()
        self._class_track_ids.clear()
        self._highest_id = 0
        self._total_unique = 0
        self._class_totals.clear()
