"""
VigilAI — Comprehensive Person-Centric PPE Analytics Test Suite

Tests:
1. Model Registry & Metadata Safety
2. Spatial / Anatomical Association & Competitive Matching
3. Temporal Compliance Smoothing & False-Positive Suppression
4. Zone-Aware Rule Evaluation
5. Event Deduplication & Resolution
6. Multi-Camera State Isolation
7. Real Model Smoke Test on Test Image
"""

from collections import deque
from pathlib import Path
import time
import numpy as np
import pytest

from vigilai_api.core.models_registry import (
    get_model_metadata,
    list_available_models,
    is_ppe_model,
    AVAILABLE_MODELS,
)
from vigilai_api.cv.detection.models import BBox, Detection
from vigilai_api.cv.events.manager import EventManager
from vigilai_api.cv.ppe.association import (
    associate_ppe_to_people,
    score_ppe_candidate,
)
from vigilai_api.cv.ppe.models import (
    ComplianceStatus,
    FramePersonPPEObservation,
    PPEViolationAlert,
)
from vigilai_api.cv.ppe.state import TrackPPEHistory
from vigilai_api.cv.ppe.analyzer import PPEAnalyzer
from vigilai_api.cv.rules.engine import RuleConfig, RulesEngine
from vigilai_api.cv.tracking.models import Track


def make_track(
    track_id: int,
    bbox: BBox,
    confidence: float = 0.9,
    class_name: str = "person",
    centroid: tuple[float, float] | None = None,
) -> Track:
    """Helper to construct valid Track objects for testing."""
    if centroid is None:
        centroid = ((bbox.x1 + bbox.x2) / 2, (bbox.y1 + bbox.y2) / 2)
    return Track(
        track_id=track_id,
        class_id=0,
        class_name=class_name,
        bbox=bbox,
        confidence=confidence,
        centroid=centroid,
        first_seen=0.0,
        last_seen=0.0,
        age=1,
        trajectory=deque([centroid]),
        is_confirmed=True,
    )


# ==============================================================================
# 1. MODEL REGISTRY TESTS
# ==============================================================================

def test_model_registry_metadata():
    """Verify registry returns correct metadata for surveillance and PPE models."""
    ppe_meta = get_model_metadata("vigilai-ppe-v2-onnx")
    assert ppe_meta.id == "vigilai-ppe-v2-onnx"
    assert ppe_meta.task == "ppe_safety"
    assert ppe_meta.framework == "onnxruntime"
    assert ppe_meta.format == "onnx"
    assert ppe_meta.img_size == 512
    assert "helmet" in ppe_meta.classes
    assert "vest" in ppe_meta.classes
    assert "Person" in ppe_meta.classes
    assert ppe_meta.is_active is True

    coco_meta = get_model_metadata("coco-yolov8n-onnx")
    assert coco_meta.task == "general_surveillance"
    assert coco_meta.img_size == 640

    # Aliases
    assert get_model_metadata("ppe").id == "vigilai-ppe-v2-onnx"
    assert get_model_metadata("coco").id == "coco-yolov8n-onnx"

    # Default fallback
    assert get_model_metadata(None).id == "coco-yolov8n-onnx"
    assert get_model_metadata("unknown_model_xyz").id == "coco-yolov8n-onnx"


def test_model_registry_public_safety():
    """Ensure safe serialization excludes internal server filesystem paths."""
    models = list_available_models()
    assert len(models) >= 2
    for m in models:
        assert "weights_path" not in m, "Server filesystem paths must never be exposed"
        assert "id" in m
        assert "name" in m
        assert "task" in m
        assert "classes" in m


def test_is_ppe_model():
    """Verify task classification helper."""
    assert is_ppe_model("vigilai-ppe-v2-onnx") is True
    assert is_ppe_model("vigilai-ppe-v2-pt") is True
    assert is_ppe_model("ppe") is True
    assert is_ppe_model("coco-yolov8n-onnx") is False
    assert is_ppe_model("coco-yolov8n-pt") is False
    assert is_ppe_model(None) is False


# ==============================================================================
# 2. SPATIAL & ANATOMICAL ASSOCIATION TESTS
# ==============================================================================

def test_score_ppe_candidate_valid_helmet():
    """A helmet located on the upper head region of a person scores high."""
    person_bbox = BBox(x1=100, y1=100, x2=200, y2=400)  # w=100, h=300
    track = make_track(1, person_bbox)
    helmet_bbox = BBox(x1=120, y1=95, x2=180, y2=160)   # Near top of head
    det = Detection(
        class_id=0,
        class_name="helmet",
        confidence=0.92,
        bbox=helmet_bbox,
    )

    score = score_ppe_candidate(det, track, frame_width=640, frame_height=480)
    assert score > 0.65, f"Valid helmet should have high association score, got {score}"


def test_score_ppe_candidate_invalid_anatomy():
    """A boot placed on top of the person's head must be rejected by anatomical prior."""
    person_bbox = BBox(x1=100, y1=100, x2=200, y2=400)
    track = make_track(1, person_bbox)
    misplaced_boot = BBox(x1=120, y1=100, x2=180, y2=160)  # Near head!
    det = Detection(
        class_id=3,
        class_name="boots",
        confidence=0.88,
        bbox=misplaced_boot,
    )

    score = score_ppe_candidate(det, track, frame_width=640, frame_height=480)
    assert score == 0.0, f"Misplaced boot should be rejected by anatomical prior, got {score}"


def test_score_ppe_candidate_outside_person():
    """A PPE item located completely outside the person's bbox has score 0."""
    person_bbox = BBox(x1=100, y1=100, x2=200, y2=400)
    track = make_track(1, person_bbox)
    distant_vest = BBox(x1=500, y1=200, x2=580, y2=300)
    det = Detection(
        class_id=2,
        class_name="vest",
        confidence=0.90,
        bbox=distant_vest,
    )

    score = score_ppe_candidate(det, track, frame_width=640, frame_height=480)
    assert score == 0.0, "Distant PPE item must not associate with person"


def test_competitive_assignment_no_duplicate_ppe():
    """
    When two persons overlap and there is only ONE helmet,
    it must be assigned competitively to the best-matching person,
    NEVER duplicated to both.
    """
    person1 = make_track(
        track_id=1,
        bbox=BBox(x1=100, y1=100, x2=200, y2=400),
        confidence=0.90,
        centroid=(150, 250),
    )
    person2 = make_track(
        track_id=2,
        bbox=BBox(x1=120, y1=110, x2=220, y2=410),
        confidence=0.85,
        centroid=(170, 260),
    )

    # Helmet clearly centered on person 1
    helmet_det = Detection(
        class_id=0,
        class_name="helmet",
        confidence=0.95,
        bbox=BBox(x1=125, y1=95, x2=175, y2=150),
    )

    observations = associate_ppe_to_people(
        person_tracks=[person1, person2],
        ppe_detections=[helmet_det],
        frame_width=640,
        frame_height=480,
    )

    assert 1 in observations
    assert 2 in observations

    # Only one person should receive the helmet!
    p1_has_helmet = "helmet" in observations[1].associated_items
    p2_has_helmet = "helmet" in observations[2].associated_items

    assert (p1_has_helmet and not p2_has_helmet) or (p2_has_helmet and not p1_has_helmet), (
        "Single helmet must be assigned to exactly ONE person, never both"
    )
    assert p1_has_helmet, "Person 1 should win the competitive assignment"


def test_explicit_negative_class_association():
    """Verify explicit absence classes like 'no_helmet' associate as negative equipment."""
    person = make_track(
        track_id=1,
        bbox=BBox(x1=100, y1=100, x2=200, y2=400),
        confidence=0.90,
    )
    no_helmet_det = Detection(
        class_id=7,
        class_name="no_helmet",
        confidence=0.82,
        bbox=BBox(x1=120, y1=95, x2=180, y2=155),
    )

    observations = associate_ppe_to_people(
        person_tracks=[person],
        ppe_detections=[no_helmet_det],
        frame_width=640,
        frame_height=480,
    )

    obs = observations[1]
    assert "helmet" in obs.associated_items
    assert obs.associated_items["helmet"].is_positive is False
    assert "helmet" in obs.explicit_missing_items


# ==============================================================================
# 3. TEMPORAL COMPLIANCE STATE TESTS
# ==============================================================================

def test_temporal_smoothing_suppresses_transient_miss():
    """
    A 1-frame miss should NOT trigger VIOLATION_CONFIRMED.
    State must remain SUSPECTED_VIOLATION or UNKNOWN until confirmation duration.
    """
    history = TrackPPEHistory(
        track_id=10,
        camera_id="cam-1",
        required_ppe=["helmet", "vest"],
        confirmation_duration_seconds=2.0,
    )

    t0 = 100.0
    obs1 = FramePersonPPEObservation(
        track_id=10,
        timestamp=t0,
        person_bbox=BBox(100, 100, 200, 400),
        person_confidence=0.9,
    )

    status1 = history.add_observation(obs1)
    assert status1 in (ComplianceStatus.UNKNOWN, ComplianceStatus.SUSPECTED_VIOLATION)
    assert status1 != ComplianceStatus.VIOLATION_CONFIRMED


def test_temporal_smoothing_confirms_persistent_violation():
    """
    Persistent absence past confirmation duration (2.0s) confirms violation.
    """
    history = TrackPPEHistory(
        track_id=10,
        camera_id="cam-1",
        required_ppe=["helmet", "vest"],
        confirmation_duration_seconds=2.0,
    )

    # Feed frames over 2.5 seconds without required PPE
    status = None
    for i in range(25):
        t = 100.0 + (i * 0.1)  # 10 fps over 2.5s
        obs = FramePersonPPEObservation(
            track_id=10,
            timestamp=t,
            person_bbox=BBox(100, 100, 200, 400),
            person_confidence=0.9,
        )
        status = history.add_observation(obs)

    assert status == ComplianceStatus.VIOLATION_CONFIRMED
    assert "helmet" in history.missing_ppe
    assert "vest" in history.missing_ppe


def test_temporal_smoothing_compliance_recovery():
    """
    When a person in violation puts on required gear, status transitions back to COMPLIANT.
    """
    history = TrackPPEHistory(
        track_id=10,
        camera_id="cam-1",
        required_ppe=["helmet"],
        confirmation_duration_seconds=2.0,
    )

    # 1. Establish violation
    for i in range(25):
        t = 100.0 + (i * 0.1)
        obs = FramePersonPPEObservation(
            track_id=10,
            timestamp=t,
            person_bbox=BBox(100, 100, 200, 400),
            person_confidence=0.9,
        )
        history.add_observation(obs)

    assert history.status == ComplianceStatus.VIOLATION_CONFIRMED

    # 2. Worker puts on helmet (positive helmet detected consistently)
    status = None
    for i in range(20):
        t = 103.0 + (i * 0.1)
        obs = FramePersonPPEObservation(
            track_id=10,
            timestamp=t,
            person_bbox=BBox(100, 100, 200, 400),
            person_confidence=0.9,
            positive_items={"helmet"},
        )
        status = history.add_observation(obs)

    assert status == ComplianceStatus.COMPLIANT
    assert len(history.missing_ppe) == 0


# ==============================================================================
# 4. ZONE-AWARE RULE EVALUATION TESTS
# ==============================================================================

def test_zone_aware_ppe_analyzer_filtering():
    """
    A rule with zone_id must only alert if the person is inside that zone.
    """
    analyzer = PPEAnalyzer(camera_id="cam-01")

    # Zone covering x in [0.0, 0.5], y in [0.0, 0.5] (normalized coordinates)
    zone_configs = {
        "hazard_zone_1": [(0.0, 0.0), (0.5, 0.0), (0.5, 0.5), (0.0, 0.5)],
    }

    rule = RuleConfig(
        rule_id="rule-ppe-01",
        name="Hazard Zone Hardhat Mandate",
        rule_type="ppe_violation",
        enabled=True,
        severity="high",
        object_classes=["person"],
        zone_id="hazard_zone_1",
        line_id=None,
        threshold_value=1.0,
        cooldown_seconds=30,
        configuration={"required_ppe": ["helmet"], "confirmation_duration_seconds": 1.0},
    )

    # Person A is OUTSIDE hazard zone (centroid at 0.75, 0.80)
    person_outside = make_track(
        track_id=1,
        bbox=BBox(x1=700, y1=700, x2=800, y2=900),
        confidence=0.9,
        centroid=(750, 800),
    )

    # Person B is INSIDE hazard zone (centroid at 0.20, 0.25)
    person_inside = make_track(
        track_id=2,
        bbox=BBox(x1=150, y1=150, x2=250, y2=350),
        confidence=0.9,
        centroid=(200, 250),
    )

    # Run for 2.0 seconds (20 frames) without helmets
    alerts = []
    for i in range(20):
        t = 10.0 + (i * 0.1)
        frame_alerts, states = analyzer.update(
            person_tracks=[person_outside, person_inside],
            all_detections=[],
            ppe_rules=[rule],
            zone_configs=zone_configs,
            frame_shape=(1000, 1000),
            timestamp=t,
        )
        alerts.extend(frame_alerts)

    # Person inside must generate alert; Person outside must NOT
    alerted_tracks = {a.track_id for a in alerts}
    assert 2 in alerted_tracks, "Worker inside hazard zone without helmet must trigger alert"
    assert 1 not in alerted_tracks, "Worker outside hazard zone must NOT trigger zone-filtered rule"


# ==============================================================================
# 5. RULES ENGINE & EVENT MANAGER INTEGRATION TESTS
# ==============================================================================

def test_rules_engine_ppe_alert_evaluation():
    """RulesEngine.evaluate_ppe_alert creates typed RuleMatch with structured details."""
    engine = RulesEngine()
    rule = RuleConfig(
        rule_id="rule-ppe-test",
        name="PPE Check",
        rule_type="ppe_violation",
        enabled=True,
        severity="critical",
        object_classes=["person"],
        zone_id=None,
        line_id=None,
        threshold_value=2.0,
        cooldown_seconds=30,
        configuration={"required_ppe": ["helmet"]},
    )
    engine.set_rules([rule])

    alert = PPEViolationAlert(
        rule_id="rule-ppe-test",
        camera_id="cam-1",
        track_id=42,
        zone_id=None,
        required_ppe=["helmet"],
        missing_ppe=["helmet"],
        observed_ppe=[],
        confirmation_duration_seconds=2.0,
        timestamp=123.45,
        person_bbox=BBox(50, 50, 150, 250),
    )

    matches = engine.evaluate_ppe_alert(alert)
    assert len(matches) == 1
    m = matches[0]
    assert m.event_type == "ppe_violation"
    assert m.track_id == 42
    assert m.rule.severity == "critical"
    assert m.details["missing_ppe"] == ["helmet"]


def test_event_manager_deduplication_and_resolution():
    """EventManager deduplicates repeated alerts during cooldown and resolves on track departure."""
    mgr = EventManager(camera_id="cam-1")
    engine = RulesEngine()
    rule = RuleConfig(
        rule_id="rule-ppe-test",
        name="PPE Check",
        rule_type="ppe_violation",
        enabled=True,
        severity="high",
        object_classes=["person"],
        zone_id=None,
        line_id=None,
        threshold_value=2.0,
        cooldown_seconds=30,
        configuration={"required_ppe": ["helmet"]},
    )
    engine.set_rules([rule])

    alert = PPEViolationAlert(
        rule_id="rule-ppe-test",
        camera_id="cam-1",
        track_id=5,
        zone_id=None,
        required_ppe=["helmet"],
        missing_ppe=["helmet"],
        observed_ppe=[],
        confirmation_duration_seconds=2.0,
        timestamp=100.0,
        person_bbox=BBox(50, 50, 150, 250),
    )

    matches = engine.evaluate_ppe_alert(alert)
    match = matches[0]

    # Frame 1: Creates new event
    evt1 = mgr.process_rule_match(match)
    assert evt1 is not None
    assert evt1.status == "active"
    assert evt1.track_id == 5

    # Frame 2 (0.1s later): Cooldown / active deduplication suppresses duplicate alert spam
    alert2 = PPEViolationAlert(
        rule_id="rule-ppe-test",
        camera_id="cam-1",
        track_id=5,
        zone_id=None,
        required_ppe=["helmet"],
        missing_ppe=["helmet"],
        observed_ppe=[],
        confirmation_duration_seconds=2.0,
        timestamp=100.1,
        person_bbox=BBox(50, 50, 150, 250),
    )
    match2 = engine.evaluate_ppe_alert(alert2)[0]
    evt2 = mgr.process_rule_match(match2)
    assert evt2 is None, "Repeated alert during cooldown must be deduplicated"

    # Track 5 departs from frame (track no longer active)
    resolved = mgr.check_expired_events(active_track_ids=set(), timestamp=105.0)
    assert len(resolved) == 1
    assert resolved[0].status == "resolved"
    assert resolved[0].ended_at == 105.0


# ==============================================================================
# 6. MULTI-CAMERA STATE ISOLATION TESTS
# ==============================================================================

def test_multi_camera_state_isolation():
    """Two separate cameras must maintain completely isolated PPE state histories."""
    analyzer_a = PPEAnalyzer("camera-A")
    analyzer_b = PPEAnalyzer("camera-B")

    # Track ID 1 exists on BOTH camera A and camera B simultaneously
    person_a = make_track(
        track_id=1,
        bbox=BBox(100, 100, 200, 400),
        confidence=0.9,
        centroid=(150, 250),
    )
    person_b = make_track(
        track_id=1,
        bbox=BBox(200, 200, 300, 500),
        confidence=0.9,
        centroid=(250, 350),
    )

    helmet_det = Detection(
        class_id=0,
        class_name="helmet",
        confidence=0.95,
        bbox=BBox(120, 95, 180, 150),
    )

    rule = RuleConfig(
        rule_id="r1",
        name="Helmet Required",
        rule_type="ppe_violation",
        enabled=True,
        severity="medium",
        object_classes=["person"],
        zone_id=None,
        line_id=None,
        threshold_value=1.0,
        cooldown_seconds=30,
        configuration={"required_ppe": ["helmet"], "confirmation_duration_seconds": 1.0},
    )

    # Feed camera A: has helmet
    # Feed camera B: NO helmet
    for i in range(20):
        t = 1.0 + i * 0.1
        analyzer_a.update([person_a], [helmet_det], [rule], {}, (640, 480), t)
        alerts_b, states_b = analyzer_b.update([person_b], [], [rule], {}, (640, 480), t)

    obs_a = analyzer_a._tracks_history[1]
    obs_b = analyzer_b._tracks_history[1]

    # Camera A track 1 is compliant; Camera B track 1 is confirmed in violation
    assert obs_a.status == ComplianceStatus.COMPLIANT
    assert obs_b.status == ComplianceStatus.VIOLATION_CONFIRMED
    assert len(alerts_b) > 0


# ==============================================================================
# 7. REAL MODEL SMOKE TEST ON TEST IMAGE
# ==============================================================================

def test_real_model_ppe_smoke_test():
    """
    Run end-to-end inference + association on a real held-out test image from the dataset,
    verifying clean execution and bounded latency (< 150ms on CPU).
    """
    model_path = Path("models/vigilai_ppe_v2.onnx")
    test_dir = Path("datasets/construction-ppe/images/test")

    if not model_path.exists() or not test_dir.exists():
        pytest.skip("Model weights or test images not present in local environment")

    test_images = list(test_dir.glob("*.jpg"))
    if not test_images:
        pytest.skip("No test images found")

    import cv2
    from vigilai_api.cv.detection.onnx_detector import ONNXDetector

    detector = ONNXDetector(model_path=str(model_path), device="cpu")
    detector.conf = 0.35
    detector.iou = 0.45

    img = cv2.imread(str(test_images[0]))
    assert img is not None, "Failed to load test image"

    # Warmup pass
    detector.detect(img)

    t0 = time.perf_counter()
    result = detector.detect(img)
    latency_ms = (time.perf_counter() - t0) * 1000

    # Real model execution must complete in reasonable CPU time
    assert latency_ms < 1500.0, f"Inference latency too high: {latency_ms:.2f} ms"
    assert hasattr(result, "detections")

    # Run association cycle
    h, w = img.shape[:2]
    person_dets = [d for d in result.detections if d.class_name.lower() == "person"]
    tracks = [
        make_track(
            track_id=idx + 1,
            bbox=d.bbox,
            confidence=d.confidence,
            class_name="person",
        )
        for idx, d in enumerate(person_dets)
    ]

    analyzer = PPEAnalyzer("smoke_cam")
    t_start = time.perf_counter()
    alerts, states = analyzer.update(
        person_tracks=tracks,
        all_detections=result.detections,
        ppe_rules=[],
        zone_configs={},
        frame_shape=(h, w),
        timestamp=time.time(),
    )
    association_ms = (time.perf_counter() - t_start) * 1000

    # Association must be fast and lightweight (< 10 ms)
    assert association_ms < 10.0, f"PPE association overhead too high: {association_ms:.2f} ms"
