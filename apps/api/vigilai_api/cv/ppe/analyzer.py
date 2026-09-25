"""
VigilAI — PPE Analyzer Engine

Coordinates person-PPE association, temporal compliance smoothing, zone-aware rule checking,
and alert generation for a single camera stream.
"""

import logging
from typing import Any, Sequence

from vigilai_api.cv.detection.models import Detection
from vigilai_api.cv.geometry.core import point_in_polygon
from vigilai_api.cv.rules.engine import RuleConfig
from vigilai_api.cv.tracking.models import Track

from .association import associate_ppe_to_people
from .models import (
    ComplianceStatus,
    FramePersonPPEObservation,
    PersonPPEState,
    PPEViolationAlert,
    STANDARD_EQUIPMENT,
)
from .state import TrackPPEHistory

logger = logging.getLogger(__name__)


class PPEAnalyzer:
    """Per-camera PPE compliance analyzer."""

    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self._tracks_history: dict[int, TrackPPEHistory] = {}
        self._last_observations: dict[int, FramePersonPPEObservation] = {}

    def update(
        self,
        person_tracks: Sequence[Track],
        all_detections: Sequence[Detection],
        ppe_rules: Sequence[RuleConfig],
        zone_configs: dict[str, Any],
        frame_shape: tuple[int, int],
        timestamp: float,
    ) -> tuple[list[PPEViolationAlert], dict[int, PersonPPEState]]:
        """
        Execute full PPE analysis cycle:
          1. Associate PPE items to people in current frame.
          2. Update rolling temporal states.
          3. Evaluate against configured zone-aware PPE violation rules.
          4. Produce confirmed violation alerts.
        """
        h, w = frame_shape[:2]
        active_track_ids = {t.track_id for t in person_tracks}

        # 1. Geometrical association
        observations = associate_ppe_to_people(
            person_tracks=person_tracks,
            ppe_detections=all_detections,
            frame_width=w,
            frame_height=h,
            timestamp=timestamp,
        )
        self._last_observations = observations

        # If no active PPE rules, keep basic state updated without generating alerts
        active_rules = [r for r in ppe_rules if r.enabled and r.rule_type == "ppe_violation"]

        alerts: list[PPEViolationAlert] = []
        states: dict[int, PersonPPEState] = {}

        for pt in person_tracks:
            tid = pt.track_id
            obs = observations.get(tid)
            if not obs:
                continue

            # Determine zones containing this person's normalized centroid
            norm_cx = pt.centroid[0] / float(w)
            norm_cy = pt.centroid[1] / float(h)
            norm_centroid = (norm_cx, norm_cy)

            matching_zones = []
            for zid, polygon in zone_configs.items():
                if polygon and point_in_polygon(norm_centroid, polygon):
                    matching_zones.append(zid)

            # Evaluate each relevant PPE rule
            for rule in active_rules:
                # Check zone filter: if rule specifies a zone, person must be inside it
                if rule.zone_id and rule.zone_id not in matching_zones:
                    continue

                # Parse rule configuration
                cfg = rule.configuration or {}
                required_items = cfg.get(
                    "required_ppe",
                    rule.object_classes or ["helmet", "vest"],
                )
                conf_duration = float(
                    cfg.get("confirmation_duration_seconds", rule.threshold_value or 2.0)
                )

                # Get or create temporal tracker for this (track_id, rule_id)
                # Key by track_id
                tracker = self._tracks_history.get(tid)
                if tracker is None or tracker.required_ppe != required_items:
                    tracker = TrackPPEHistory(
                        track_id=tid,
                        camera_id=self.camera_id,
                        required_ppe=required_items,
                        confirmation_duration_seconds=conf_duration,
                    )
                    self._tracks_history[tid] = tracker

                current_zone = rule.zone_id if rule.zone_id in matching_zones else (matching_zones[0] if matching_zones else None)
                status = tracker.add_observation(obs, zone_id=current_zone)
                state = tracker.to_state()
                states[tid] = state

                if status == ComplianceStatus.VIOLATION_CONFIRMED and tracker.missing_ppe:
                    alert = PPEViolationAlert(
                        rule_id=rule.rule_id,
                        camera_id=self.camera_id,
                        track_id=tid,
                        zone_id=current_zone,
                        required_ppe=list(tracker.required_ppe),
                        missing_ppe=list(tracker.missing_ppe),
                        observed_ppe=list(tracker.observed_ppe),
                        confirmation_duration_seconds=conf_duration,
                        timestamp=timestamp,
                        person_bbox=pt.bbox,
                        associated_items=obs.associated_items,
                    )
                    alerts.append(alert)

        # Cleanup expired tracks
        self.cleanup_stale_tracks(active_track_ids, timestamp)

        return alerts, states

    def cleanup_stale_tracks(self, active_track_ids: set[int], timestamp: float) -> list[int]:
        """Remove state for tracks that have disappeared from ByteTrack."""
        stale_ids = [tid for tid in self._tracks_history if tid not in active_track_ids]
        for tid in stale_ids:
            del self._tracks_history[tid]
            self._last_observations.pop(tid, None)
        return stale_ids

    def get_track_observation(self, track_id: int) -> FramePersonPPEObservation | None:
        """Get the latest raw observation for a track."""
        return self._last_observations.get(track_id)

    def get_track_state(self, track_id: int) -> PersonPPEState | None:
        """Get the latest temporal compliance state for a track."""
        tracker = self._tracks_history.get(track_id)
        return tracker.to_state() if tracker else None
