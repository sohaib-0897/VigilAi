"""Profile each stage of the video analytics pipeline separately for PyTorch and ONNX.

Measures:
1. Preprocessing (letterbox, color convert, normalize, CHW)
2. Raw model inference (forward pass)
3. Postprocessing & NMS
4. ByteTrack tracking
5. Geometry & Analytics (zones, lines, dwell)
6. Rule evaluation & Event deduplication
7. Frame annotation
"""

import sys
import time
from pathlib import Path
import numpy as np
import cv2

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from vigilai_api.cv.detection.yolo import YOLODetector
from vigilai_api.cv.detection.onnx_detector import ONNXDetector
from vigilai_api.cv.tracking.byte_tracker import ByteTrackTracker
from vigilai_api.cv.analytics.zone_analytics import ZoneAnalyzer
from vigilai_api.cv.analytics.line_analytics import LineAnalyzer
from vigilai_api.cv.analytics.dwell_analytics import DwellAnalyzer
from vigilai_api.cv.rules.engine import RulesEngine, RuleConfig
from vigilai_api.cv.events.manager import EventManager
from vigilai_api.cv.annotator import FrameAnnotator

def profile_stages(iterations: int = 50):
    # Load or generate test frame (1080p)
    test_video = Path("benchmarks/data/surveillance_1080p_30fps.mp4")
    if test_video.exists():
        cap = cv2.VideoCapture(str(test_video))
        ret, frame = cap.read()
        cap.release()
        assert ret and frame is not None
    else:
        frame = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)

    print(f"Profiling frame size: {frame.shape[1]}x{frame.shape[0]} across {iterations} iterations\n")

    # Initialize models
    yolo_det = YOLODetector("yolov8n.pt", device="cpu")
    onnx_det = ONNXDetector("models/yolov8n.onnx", device="cpu")

    # Warmup
    for _ in range(5):
        yolo_det.detect(frame)
        onnx_det.detect(frame)

    # 1. Profile PyTorch breakdown
    # In PyTorch / Ultralytics, let's time the full detect vs internal steps if accessible
    pt_total_times = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        pt_res = yolo_det.detect(frame)
        pt_total_times.append((time.perf_counter() - t0) * 1000)

    # 2. Profile ONNX breakdown (step-by-step)
    onnx_prep_times = []
    onnx_infer_times = []
    onnx_post_times = []
    onnx_total_times = []

    h, w = frame.shape[:2]
    img_size = onnx_det.img_size

    for _ in range(iterations):
        t0 = time.perf_counter()

        # Step 2a: Preprocessing
        t_pre = time.perf_counter()
        scale = min(img_size / w, img_size / h)
        resized_w, resized_h = round(w * scale), round(h * scale)
        left = round((img_size - resized_w) / 2 - 0.1)
        top = round((img_size - resized_h) / 2 - 0.1)
        img = np.full((img_size, img_size, 3), 114, dtype=np.uint8)
        img[top : top + resized_h, left : left + resized_w] = cv2.resize(
            frame, (resized_w, resized_h)
        )
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.transpose((2, 0, 1))[np.newaxis, :, :, :] / 255.0
        img = img.astype(np.float32)
        onnx_prep_times.append((time.perf_counter() - t_pre) * 1000)

        # Step 2b: Raw ONNX Session Run
        t_inf = time.perf_counter()
        outputs = onnx_det.session.run(None, {onnx_det.input_name: img})[0]
        onnx_infer_times.append((time.perf_counter() - t_inf) * 1000)

        # Step 2c: Postprocessing & NMS
        t_post = time.perf_counter()
        outputs = np.transpose(np.squeeze(outputs))
        boxes = outputs[:, :4]
        scores = outputs[:, 4:]
        class_ids = np.argmax(scores, axis=1)
        confidences = np.max(scores, axis=1)
        mask = confidences > onnx_det.conf
        boxes = boxes[mask]
        class_ids = class_ids[mask]
        confidences = confidences[mask]
        x_c, y_c, w_b, h_b = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        boxes = np.stack([x_c - w_b / 2, y_c - h_b / 2, x_c + w_b / 2, y_c + h_b / 2], axis=1)
        boxes[:, [0, 2]] = np.clip((boxes[:, [0, 2]] - left) / scale, 0, w)
        boxes[:, [1, 3]] = np.clip((boxes[:, [1, 3]] - top) / scale, 0, h)
        xywh = boxes.copy()
        xywh[:, 2:] -= xywh[:, :2]
        indices = []
        for class_id in np.unique(class_ids):
            candidates = np.flatnonzero(class_ids == class_id)
            kept = cv2.dnn.NMSBoxes(
                xywh[candidates].tolist(), confidences[candidates].tolist(), onnx_det.conf, onnx_det.iou
            )
            if len(kept):
                indices.extend(candidates[np.asarray(kept).flatten()].tolist())
        onnx_post_times.append((time.perf_counter() - t_post) * 1000)
        onnx_total_times.append((time.perf_counter() - t0) * 1000)

    # 3. Profile Tracking (ByteTrack)
    tracker = ByteTrackTracker(track_thresh=0.45, track_buffer=30, match_thresh=0.8)
    sample_detections = pt_res.detections
    track_times = []
    for _ in range(iterations):
        t_trk = time.perf_counter()
        res_track = tracker.update(sample_detections, frame)
        track_times.append((time.perf_counter() - t_trk) * 1000)

    # 4. Profile Geometry & Analytics
    zone_analyzer = ZoneAnalyzer()
    zone_analyzer.set_zones({"z1": [(0.1, 0.1), (0.9, 0.1), (0.9, 0.9), (0.1, 0.9)]})
    line_analyzer = LineAnalyzer()
    line_analyzer.set_lines({"l1": ((0.5, 0.0), (0.5, 1.0), "both")})
    dwell_analyzer = DwellAnalyzer()
    dwell_analyzer.set_thresholds({"z1": 2.0})

    analytics_times = []
    tracks = res_track.tracks if hasattr(res_track, "tracks") else []
    for _ in range(iterations):
        t_an = time.perf_counter()
        ze = zone_analyzer.update(tracks, time.time())
        le = line_analyzer.update(tracks, time.time())
        da = dwell_analyzer.check_thresholds(time.time())
        analytics_times.append((time.perf_counter() - t_an) * 1000)

    # 5. Profile Rules & Event Deduplication
    rules_engine = RulesEngine()
    rules_engine.set_rules([
        RuleConfig(rule_id="r1", name="Entry", rule_type="zone_entry", enabled=True, severity="high", object_classes=None, zone_id="z1", line_id=None, threshold_value=None, cooldown_seconds=30, configuration=None),
        RuleConfig(rule_id="r2", name="Line", rule_type="line_crossing", enabled=True, severity="medium", object_classes=None, zone_id=None, line_id="l1", threshold_value=None, cooldown_seconds=30, configuration=None),
    ])
    event_manager = EventManager("bench-cam")
    rule_event_times = []
    for _ in range(iterations):
        t_re = time.perf_counter()
        matches = []
        for z in ze:
            matches.extend(rules_engine.evaluate_zone_event(z))
        for l in le:
            matches.extend(rules_engine.evaluate_line_crossing(l))
        for m in matches:
            event_manager.process_rule_match(m, frame)
        rule_event_times.append((time.perf_counter() - t_re) * 1000)

    # 6. Profile Annotator
    annotator = FrameAnnotator()
    annot_times = []
    for _ in range(iterations):
        t_an = time.perf_counter()
        annotator.annotate(frame.copy(), tracks, zones={"z1": [(0.1, 0.1), (0.9, 0.1), (0.9, 0.9), (0.1, 0.9)]})
        annot_times.append((time.perf_counter() - t_an) * 1000)

    print("================================================================")
    print("  STAGE-BY-STAGE LATENCY BREAKDOWN (Mean ms ± Std)")
    print("================================================================")
    print(f"PyTorch Total Detection:     {np.mean(pt_total_times):.2f} ms ± {np.std(pt_total_times):.2f} ms")
    print(f"  -> Implied FPS:            {1000/np.mean(pt_total_times):.1f} FPS\n")

    print(f"ONNX Total Detection:        {np.mean(onnx_total_times):.2f} ms ± {np.std(onnx_total_times):.2f} ms")
    print(f"  ├─ 1. Preprocessing:       {np.mean(onnx_prep_times):.2f} ms ({np.mean(onnx_prep_times)/np.mean(onnx_total_times)*100:.1f}%)")
    print(f"  ├─ 2. ONNX Forward Pass:   {np.mean(onnx_infer_times):.2f} ms ({np.mean(onnx_infer_times)/np.mean(onnx_total_times)*100:.1f}%)")
    print(f"  └─ 3. Postprocessing/NMS:  {np.mean(onnx_post_times):.2f} ms ({np.mean(onnx_post_times)/np.mean(onnx_total_times)*100:.1f}%)")
    print(f"  -> Implied FPS:            {1000/np.mean(onnx_total_times):.1f} FPS\n")

    print(f"ByteTrack Tracking:          {np.mean(track_times):.2f} ms")
    print(f"Geometry & Analytics:        {np.mean(analytics_times):.2f} ms")
    print(f"Rules & Event Deduplication: {np.mean(rule_event_times):.2f} ms")
    print(f"Frame HUD Annotation:        {np.mean(annot_times):.2f} ms")
    print("================================================================")

if __name__ == "__main__":
    profile_stages(50)
