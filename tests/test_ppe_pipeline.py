import json
from pathlib import Path
import numpy as np
import pytest

from vigilai_api.cv.detection.models import DetectionResult
from vigilai_api.cv.detection.onnx_detector import ONNXDetector
from vigilai_api.cv.detection.yolo import YOLODetector


def test_ppe_dataset_validation_report():
    report_path = Path("benchmarks/ppe_dataset_report.json")
    assert report_path.exists(), "ppe_dataset_report.json should exist"

    with open(report_path) as f:
        data = json.load(f)

    summary = data["summary"]
    splits = data["split_breakdown"]
    assert summary["total_images"] == 1416
    assert splits["train"]["images_count"] == 1132
    assert splits["val"]["images_count"] == 143
    assert splits["test"]["images_count"] == 141
    assert summary["corrupt_images_count"] == 0
    assert summary["invalid_labels_count"] == 0
    assert summary["cross_split_leakage_pairs_count"] == 0
    assert len(data["per_class_distribution_overall"]) == 11


def test_ppe_training_report():
    report_path = Path("training_output/vigilai_ppe_v2_full/training_report.json")
    assert report_path.exists(), "training_report.json should exist"

    with open(report_path) as f:
        data = json.load(f)

    assert data["experiment_name"] == "vigilai_ppe_v2_full"
    assert data["epochs_completed"] == 12
    assert data["training_time_seconds"] > 0
    assert data["num_classes"] == 11
    assert data["metrics"]["mAP50"] > 0.50


def test_ppe_held_out_test_results():
    test_path = Path("benchmarks/ppe_test_results.json")
    assert test_path.exists(), "ppe_test_results.json should exist"

    with open(test_path) as f:
        data = json.load(f)

    assert data["split"] == "test"
    assert data["metrics"]["precision"] > 0.40
    assert data["metrics"]["recall"] > 0.40
    assert data["metrics"]["mAP50"] > 0.50

    per_class = data["per_class_metrics"]
    assert len(per_class) == 11
    assert per_class["helmet"]["mAP50"] > 0.85
    assert per_class["vest"]["mAP50"] > 0.85
    assert per_class["Person"]["mAP50"] > 0.80


def test_ppe_inference_benchmarks():
    bench_path = Path("benchmarks/ppe_inference_benchmarks.json")
    assert bench_path.exists(), "ppe_inference_benchmarks.json should exist"

    with open(bench_path) as f:
        data = json.load(f)

    backends = data["backends"]
    assert "pytorch" in backends
    assert "onnxruntime" in backends

    pt_fps = backends["pytorch"]["fps"]
    onnx_fps = backends["onnxruntime"]["fps"]
    assert pt_fps > 0
    assert onnx_fps > 0
    # ONNX Runtime on CPU should be faster than PyTorch
    assert onnx_fps > pt_fps


def test_ppe_pytorch_detector_loading():
    pt_path = Path("models/vigilai_ppe_v2.pt")
    if not pt_path.exists():
        pytest.skip("models/vigilai_ppe_v2.pt not present")

    detector = YOLODetector(str(pt_path), device="cpu")
    assert len(detector.classes) == 11
    assert detector.classes[0] == "helmet"
    assert detector.classes[2] == "vest"
    assert detector.classes[6] == "Person"

    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res = detector.detect(frame)
    assert isinstance(res, DetectionResult)


def test_ppe_onnx_detector_loading_and_metadata():
    onnx_path = Path("models/vigilai_ppe_v2.onnx")
    if not onnx_path.exists():
        pytest.skip("models/vigilai_ppe_v2.onnx not present")

    detector = ONNXDetector(str(onnx_path), device="cpu")
    assert len(detector.classes) == 11
    assert detector.classes[0] == "helmet"
    assert detector.classes[2] == "vest"
    assert detector.classes[6] == "Person"
    assert detector.img_size == 512

    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res = detector.detect(frame)
    assert isinstance(res, DetectionResult)
    assert res.frame_size == (640, 480)
