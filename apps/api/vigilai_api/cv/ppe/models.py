"""
VigilAI — Person-Centric PPE Analytics Models

Typed data structures representing PPE equipment types, body region priors,
association records, temporal compliance states, and violation alerts.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from vigilai_api.cv.detection.models import BBox, Detection


class ComplianceStatus(str, Enum):
    UNKNOWN = "UNKNOWN"
    COMPLIANT = "COMPLIANT"
    SUSPECTED_VIOLATION = "SUSPECTED_VIOLATION"
    VIOLATION_CONFIRMED = "VIOLATION_CONFIRMED"
    RESOLVED = "RESOLVED"


STANDARD_EQUIPMENT = ("helmet", "vest", "gloves", "goggles", "boots")

POSITIVE_TO_NEGATIVE: dict[str, str] = {
    "helmet": "no_helmet",
    "gloves": "no_gloves",
    "goggles": "no_goggle",
    "boots": "no_boots",
}

NEGATIVE_TO_POSITIVE: dict[str, str] = {
    "no_helmet": "helmet",
    "no_gloves": "gloves",
    "no_goggle": "goggles",
    "no_boots": "boots",
}


@dataclass(frozen=True)
class BodyRegionPrior:
    """Normalized vertical bounds relative to Person bounding box (y_top=0.0, y_bottom=1.0)."""

    y_min: float
    y_max: float
    y_center: float


# Anatomically defensible region priors (with generous margins for motion, orientation, and pose)
BODY_REGION_PRIORS: dict[str, BodyRegionPrior] = {
    "helmet": BodyRegionPrior(y_min=-0.20, y_max=0.45, y_center=0.10),
    "no_helmet": BodyRegionPrior(y_min=-0.20, y_max=0.45, y_center=0.10),
    "goggles": BodyRegionPrior(y_min=-0.05, y_max=0.38, y_center=0.18),
    "no_goggle": BodyRegionPrior(y_min=-0.05, y_max=0.38, y_center=0.18),
    "vest": BodyRegionPrior(y_min=0.08, y_max=0.78, y_center=0.40),
    "gloves": BodyRegionPrior(y_min=0.20, y_max=0.90, y_center=0.55),
    "no_gloves": BodyRegionPrior(y_min=0.20, y_max=0.90, y_center=0.55),
    "boots": BodyRegionPrior(y_min=0.60, y_max=1.20, y_center=0.90),
    "no_boots": BodyRegionPrior(y_min=0.60, y_max=1.20, y_center=0.90),
}


@dataclass
class AssociatedPPEItem:
    """A detected PPE item associated with a specific person."""

    equipment_type: str  # "helmet", "vest", etc.
    raw_class_name: str  # "helmet" or "no_helmet"
    is_positive: bool  # True if PPE is present, False if explicit absence
    confidence: float
    bbox: BBox
    association_score: float


@dataclass
class FramePersonPPEObservation:
    """Single-frame snapshot of PPE items associated with one tracked person."""

    track_id: int
    timestamp: float
    person_bbox: BBox
    person_confidence: float
    associated_items: dict[str, AssociatedPPEItem] = field(default_factory=dict)
    # Set of equipment types detected as positive
    positive_items: set[str] = field(default_factory=set)
    # Set of equipment types detected with explicit negative class (e.g. no_helmet)
    explicit_missing_items: set[str] = field(default_factory=set)


@dataclass
class PersonPPEState:
    """Persistent, stateful temporal compliance tracking for a single person."""

    track_id: int
    camera_id: str
    status: ComplianceStatus
    required_ppe: list[str]
    missing_ppe: list[str] = field(default_factory=list)
    observed_ppe: list[str] = field(default_factory=list)
    suspected_since: float | None = None
    confirmed_since: float | None = None
    last_updated: float = 0.0
    zone_id: str | None = None
    consecutive_missing_seconds: float = 0.0


@dataclass
class PPEViolationAlert:
    """Structured alert generated when a person's PPE non-compliance is confirmed past threshold."""

    rule_id: str
    camera_id: str
    track_id: int
    zone_id: str | None
    required_ppe: list[str]
    missing_ppe: list[str]
    observed_ppe: list[str]
    confirmation_duration_seconds: float
    timestamp: float
    person_bbox: BBox
    associated_items: dict[str, AssociatedPPEItem] = field(default_factory=dict)

    def to_event_details(self) -> dict[str, Any]:
        """Convert alert into structured event metadata dictionary."""
        return {
            "track_id": self.track_id,
            "zone_id": self.zone_id,
            "required_ppe": self.required_ppe,
            "missing_ppe": self.missing_ppe,
            "observed_ppe": self.observed_ppe,
            "confirmation_duration_ms": round(self.confirmation_duration_seconds * 1000, 1),
            "model_version": "vigilai_ppe_v2",
            "person_bbox": {
                "x1": round(self.person_bbox.x1, 1),
                "y1": round(self.person_bbox.y1, 1),
                "x2": round(self.person_bbox.x2, 1),
                "y2": round(self.person_bbox.y2, 1),
            },
        }
