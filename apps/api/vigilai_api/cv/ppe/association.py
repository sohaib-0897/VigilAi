"""
VigilAI — Person-Centric PPE Association

Geometrically maps detected PPE items to tracked people using body-region priors,
containment ratios, horizontal centering, and global assignment for overlapping persons.
"""

from typing import Sequence

from vigilai_api.cv.detection.models import BBox, Detection
from vigilai_api.cv.tracking.models import Track

from .models import (
    BODY_REGION_PRIORS,
    NEGATIVE_TO_POSITIVE,
    POSITIVE_TO_NEGATIVE,
    STANDARD_EQUIPMENT,
    AssociatedPPEItem,
    FramePersonPPEObservation,
)


def compute_box_intersection_ratio(ppe_box: BBox, person_box: BBox) -> float:
    """Compute fraction of PPE box area that is contained within the person box."""
    ix1 = max(ppe_box.x1, person_box.x1)
    iy1 = max(ppe_box.y1, person_box.y1)
    ix2 = min(ppe_box.x2, person_box.x2)
    iy2 = min(ppe_box.y2, person_box.y2)

    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    intersection_area = (ix2 - ix1) * (iy2 - iy1)
    ppe_area = max(1.0, (ppe_box.x2 - ppe_box.x1) * (ppe_box.y2 - ppe_box.y1))
    return min(1.0, intersection_area / ppe_area)


def score_ppe_candidate(
    ppe_det: Detection,
    person_track: Track,
    frame_width: int,
    frame_height: int,
) -> float:
    """
    Compute a defensible geometric matching score between a PPE detection and a tracked person.
    Returns score in [0.0, 1.0], or 0.0 if geometrically invalid.
    """
    pb = person_track.bbox
    pw = max(1.0, pb.x2 - pb.x1)
    ph = max(1.0, pb.y2 - pb.y1)

    db = ppe_det.bbox
    dc_x = (db.x1 + db.x2) / 2.0
    dc_y = (db.y1 + db.y2) / 2.0

    # 1. Horizontal check: PPE centroid must be within person horizontal bounds with a 25% margin
    h_margin = 0.25 * pw
    if dc_x < (pb.x1 - h_margin) or dc_x > (pb.x2 + h_margin):
        return 0.0

    # 2. Vertical check using body region prior
    raw_name = ppe_det.class_name.lower().strip()
    prior = BODY_REGION_PRIORS.get(raw_name)
    if prior:
        # Normalized relative Y in person frame: 0.0 is top of head, 1.0 is soles of feet
        rel_y = (dc_y - pb.y1) / ph
        if rel_y < prior.y_min or rel_y > prior.y_max:
            return 0.0
        # Alignment score: maximum when close to expected center
        alignment_score = max(0.0, 1.0 - abs(rel_y - prior.y_center) / 0.50)
    else:
        alignment_score = 0.5

    # 3. Containment / intersection ratio
    intersection_ratio = compute_box_intersection_ratio(db, pb)

    # If completely disjoint and centroid is outside person box, reject
    if intersection_ratio < 0.05 and (dc_x < pb.x1 or dc_x > pb.x2 or dc_y < pb.y1 or dc_y > pb.y2):
        return 0.0

    # 4. Horizontal center alignment (prefer person whose center axis is closer)
    person_cx = (pb.x1 + pb.x2) / 2.0
    h_dist_norm = abs(dc_x - person_cx) / (pw / 2.0)
    h_alignment = max(0.0, 1.0 - min(1.0, h_dist_norm))

    # Weighted composite score:
    # 45% containment, 35% vertical anatomical prior alignment, 20% horizontal center alignment
    score = (0.45 * intersection_ratio) + (0.35 * alignment_score) + (0.20 * h_alignment)
    return round(float(score), 4)


def associate_ppe_to_people(
    person_tracks: Sequence[Track],
    ppe_detections: Sequence[Detection],
    frame_width: int,
    frame_height: int,
    min_association_score: float = 0.25,
    timestamp: float | None = None,
) -> dict[int, FramePersonPPEObservation]:
    """
    Associate PPE detections to tracked people across the current frame.
    Enforces that each PPE item is assigned to at most ONE person.
    Handles crowded/overlapping people deterministically via competitive candidate scoring.
    """
    import time

    now = timestamp if timestamp is not None else time.time()

    observations: dict[int, FramePersonPPEObservation] = {}
    for pt in person_tracks:
        observations[pt.track_id] = FramePersonPPEObservation(
            track_id=pt.track_id,
            timestamp=now,
            person_bbox=pt.bbox,
            person_confidence=pt.confidence,
        )

    if not person_tracks or not ppe_detections:
        return observations

    # Filter out Person detections from PPE items list if present
    relevant_ppe: list[Detection] = [
        d for d in ppe_detections if d.class_name.lower() not in ("person", "none")
    ]

    # Build competitive candidate list: (score, ppe_confidence, ppe_idx, track_id)
    candidate_matches = []
    for ppe_idx, ppe_det in enumerate(relevant_ppe):
        for pt in person_tracks:
            score = score_ppe_candidate(ppe_det, pt, frame_width, frame_height)
            if score >= min_association_score:
                candidate_matches.append((score, ppe_det.confidence, ppe_idx, pt.track_id))

    # Sort descending by composite score, then detection confidence
    candidate_matches.sort(key=lambda x: (x[0], x[1]), reverse=True)

    assigned_ppe_indices: set[int] = set()
    # Map (track_id, equipment_type) -> AssociatedPPEItem
    # A person can have only one detection per equipment type per frame
    # (e.g. if two helmets match, the higher scoring/confidence one wins)
    person_equipment_assigned: dict[tuple[int, str], AssociatedPPEItem] = {}

    for score, conf, ppe_idx, track_id in candidate_matches:
        if ppe_idx in assigned_ppe_indices:
            continue

        ppe_det = relevant_ppe[ppe_idx]
        raw_name = ppe_det.class_name.lower().strip()

        # Determine normalized equipment type and positive/negative polarity
        if raw_name in NEGATIVE_TO_POSITIVE:
            equipment_type = NEGATIVE_TO_POSITIVE[raw_name]
            is_positive = False
        else:
            equipment_type = raw_name
            is_positive = True

        key = (track_id, equipment_type)
        if key in person_equipment_assigned:
            # Person already has an assigned item for this equipment type in this frame
            continue

        associated_item = AssociatedPPEItem(
            equipment_type=equipment_type,
            raw_class_name=raw_name,
            is_positive=is_positive,
            confidence=float(ppe_det.confidence),
            bbox=ppe_det.bbox,
            association_score=score,
        )

        assigned_ppe_indices.add(ppe_idx)
        person_equipment_assigned[key] = associated_item

        obs = observations[track_id]
        obs.associated_items[equipment_type] = associated_item
        if is_positive:
            obs.positive_items.add(equipment_type)
        else:
            obs.explicit_missing_items.add(equipment_type)

    return observations
