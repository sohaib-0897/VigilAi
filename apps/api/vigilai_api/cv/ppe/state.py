"""
VigilAI — Temporal PPE Compliance State Machine

Maintains bounded temporal observation history per tracked person.
Implements the deterministic state transitions:
  UNKNOWN -> COMPLIANT | SUSPECTED_VIOLATION -> VIOLATION_CONFIRMED -> RESOLVED
"""

from collections import deque
from typing import Sequence

from .models import (
    ComplianceStatus,
    FramePersonPPEObservation,
    PersonPPEState,
    STANDARD_EQUIPMENT,
)


class TrackPPEHistory:
    """Bounded temporal observation buffer and state tracker for a single person track."""

    def __init__(
        self,
        track_id: int,
        camera_id: str,
        required_ppe: Sequence[str],
        confirmation_duration_seconds: float = 2.0,
        max_history_len: int = 60,
    ):
        self.track_id = track_id
        self.camera_id = camera_id
        self.required_ppe = list(required_ppe)
        self.confirmation_duration_seconds = confirmation_duration_seconds
        self.history: deque[FramePersonPPEObservation] = deque(maxlen=max_history_len)

        self.status = ComplianceStatus.UNKNOWN
        self.missing_ppe: list[str] = []
        self.observed_ppe: list[str] = []

        self.suspected_since: float | None = None
        self.confirmed_since: float | None = None
        self.last_timestamp: float = 0.0
        self.zone_id: str | None = None

    def add_observation(
        self,
        obs: FramePersonPPEObservation,
        zone_id: str | None = None,
    ) -> ComplianceStatus:
        """
        Incorporate a new single-frame observation and update the compliance state machine.
        Returns the updated ComplianceStatus.
        """
        self.history.append(obs)
        self.last_timestamp = obs.timestamp
        self.zone_id = zone_id

        # Minimum observations required before making non-UNKNOWN determination
        if len(self.history) < 3:
            self.status = ComplianceStatus.UNKNOWN
            return self.status

        # Evaluate compliance across the rolling window
        current_time = obs.timestamp
        window_duration = self.confirmation_duration_seconds

        # Get observations falling within the rolling evaluation window
        relevant_window = [
            o for o in self.history if (current_time - o.timestamp) <= max(window_duration, 1.5)
        ]
        window_count = len(relevant_window)
        if window_count < 3:
            self.status = ComplianceStatus.UNKNOWN
            return self.status

        missing_items = []
        observed_items = []

        for req in self.required_ppe:
            req_clean = req.lower().strip()
            # Count positive sightings in rolling window
            pos_count = sum(1 for o in relevant_window if req_clean in o.positive_items)
            pos_ratio = pos_count / float(window_count)

            # Count explicit absence sightings (e.g. no_helmet)
            neg_count = sum(1 for o in relevant_window if req_clean in o.explicit_missing_items)
            neg_ratio = neg_count / float(window_count)

            # Conservative detection logic:
            # If positive item was observed in >= 35% of recent frames, treat as COMPLIANT
            # This protects against detector flicker, turning, motion blur, and partial occlusions
            if pos_ratio >= 0.35:
                observed_items.append(req_clean)
            elif neg_ratio >= 0.25:
                # Explicit negative class detected with persistence
                missing_items.append(req_clean)
            else:
                # Neither positive nor explicit negative: persistent absence
                # If positive ratio is near zero (< 0.15), flag as missing
                if pos_ratio < 0.15:
                    missing_items.append(req_clean)
                else:
                    observed_items.append(req_clean)

        self.missing_ppe = missing_items
        self.observed_ppe = observed_items

        # --- State Machine Transitions ---
        if not missing_items:
            # Person has all required equipment observed
            if self.status == ComplianceStatus.VIOLATION_CONFIRMED:
                self.status = ComplianceStatus.RESOLVED
            else:
                self.status = ComplianceStatus.COMPLIANT
            self.suspected_since = None
            self.confirmed_since = None

        else:
            # One or more required items are missing
            if self.suspected_since is None:
                self.suspected_since = current_time

            elapsed_suspected = current_time - self.suspected_since

            if elapsed_suspected >= self.confirmation_duration_seconds:
                if self.status != ComplianceStatus.VIOLATION_CONFIRMED:
                    self.status = ComplianceStatus.VIOLATION_CONFIRMED
                    self.confirmed_since = current_time
            else:
                self.status = ComplianceStatus.SUSPECTED_VIOLATION

        return self.status

    def to_state(self) -> PersonPPEState:
        """Export current state snapshot."""
        now = self.last_timestamp
        consecutive_missing = (
            (now - self.suspected_since) if self.suspected_since is not None else 0.0
        )
        return PersonPPEState(
            track_id=self.track_id,
            camera_id=self.camera_id,
            status=self.status,
            required_ppe=list(self.required_ppe),
            missing_ppe=list(self.missing_ppe),
            observed_ppe=list(self.observed_ppe),
            suspected_since=self.suspected_since,
            confirmed_since=self.confirmed_since,
            last_updated=self.last_timestamp,
            zone_id=self.zone_id,
            consecutive_missing_seconds=max(0.0, consecutive_missing),
        )
