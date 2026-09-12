from collections import deque
from dataclasses import dataclass

from ..detection.models import BBox


@dataclass
class Track:
    track_id: int
    class_id: int
    class_name: str
    bbox: BBox
    confidence: float
    centroid: tuple[float, float]
    first_seen: float
    last_seen: float
    age: int
    trajectory: deque[tuple[float, float]]
    is_confirmed: bool


@dataclass
class TrackingResult:
    tracks: list[Track]
    processing_time_ms: float
    active_track_count: int
    total_tracks_created: int
