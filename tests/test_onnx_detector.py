from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from vigilai_api.cv.detection.models import DetectionResult


def test_onnx_detector_initialization_and_properties():
    with patch("vigilai_api.cv.detection.onnx_detector.ort") as mock_ort:
        mock_session = MagicMock()
        mock_input = MagicMock()
        mock_input.name = "images"
        mock_session.get_inputs.return_value = [mock_input]
        mock_ort.InferenceSession.return_value = mock_session

        from vigilai_api.cv.detection.onnx_detector import ONNXDetector

        detector = ONNXDetector("models/yolov8n.onnx", device="cpu")
        assert detector.model_name == "models/yolov8n.onnx"
        assert detector.device == "cpu"
        assert 0 in detector.classes
        assert detector.classes[0] == "person"
        assert detector.conf == 0.25
        assert detector.iou == 0.45


def test_onnx_detector_configure():
    with patch("vigilai_api.cv.detection.onnx_detector.ort") as mock_ort:
        mock_session = MagicMock()
        mock_input = MagicMock()
        mock_input.name = "images"
        mock_session.get_inputs.return_value = [mock_input]
        mock_ort.InferenceSession.return_value = mock_session

        from vigilai_api.cv.detection.onnx_detector import ONNXDetector

        detector = ONNXDetector("models/yolov8n.onnx")
        detector.configure(confidence=0.6, iou_threshold=0.5, enabled_classes=[0, 2], img_size=320)
        assert detector.conf == 0.6
        assert detector.iou == 0.5
        assert detector.enabled_classes == [0, 2]
        assert detector.img_size == 320


def test_onnx_detector_mock_inference():
    with patch("vigilai_api.cv.detection.onnx_detector.ort") as mock_ort:
        mock_session = MagicMock()
        mock_input = MagicMock()
        mock_input.name = "images"
        mock_session.get_inputs.return_value = [mock_input]

        # Simulate YOLOv8 ONNX output shape: (1, 84, 10) -> (batch, 4+classes, anchors)
        # 4 box coordinates (cx, cy, w, h) + 80 class scores
        mock_output = np.zeros((1, 84, 10), dtype=np.float32)
        # Anchor 0: box in center of 640x640, class 0 (person) with confidence 0.92
        mock_output[0, 0, 0] = 320.0  # cx
        mock_output[0, 1, 0] = 320.0  # cy
        mock_output[0, 2, 0] = 100.0  # w
        mock_output[0, 3, 0] = 200.0  # h
        mock_output[0, 4 + 0, 0] = 0.92  # class 0 score

        # Anchor 1: box, class 2 (car) with confidence 0.85
        mock_output[0, 0, 1] = 150.0
        mock_output[0, 1, 1] = 150.0
        mock_output[0, 2, 1] = 80.0
        mock_output[0, 3, 1] = 80.0
        mock_output[0, 4 + 2, 1] = 0.85  # class 2 score

        mock_session.run.return_value = [mock_output]
        mock_ort.InferenceSession.return_value = mock_session

        from vigilai_api.cv.detection.onnx_detector import ONNXDetector

        detector = ONNXDetector("models/yolov8n.onnx")
        frame = np.zeros((480, 640, 3), dtype=np.uint8)

        result = detector.detect(frame)
        assert isinstance(result, DetectionResult)
        assert len(result.detections) >= 1
        classes_found = {d.class_name for d in result.detections}
        assert "person" in classes_found or "car" in classes_found
        for det in result.detections:
            assert det.confidence >= detector.conf
            assert det.bbox.x1 < det.bbox.x2
            assert det.bbox.y1 < det.bbox.y2


def test_onnx_detector_enabled_classes_filter():
    with patch("vigilai_api.cv.detection.onnx_detector.ort") as mock_ort:
        mock_session = MagicMock()
        mock_input = MagicMock()
        mock_input.name = "images"
        mock_session.get_inputs.return_value = [mock_input]

        mock_output = np.zeros((1, 84, 10), dtype=np.float32)
        # Class 0 (person)
        mock_output[0, 0, 0] = 320.0
        mock_output[0, 1, 0] = 320.0
        mock_output[0, 2, 0] = 100.0
        mock_output[0, 3, 0] = 200.0
        mock_output[0, 4 + 0, 0] = 0.95

        # Class 2 (car)
        mock_output[0, 0, 1] = 100.0
        mock_output[0, 1, 1] = 100.0
        mock_output[0, 2, 1] = 50.0
        mock_output[0, 3, 1] = 50.0
        mock_output[0, 4 + 2, 1] = 0.90

        mock_session.run.return_value = [mock_output]
        mock_ort.InferenceSession.return_value = mock_session

        from vigilai_api.cv.detection.onnx_detector import ONNXDetector

        detector = ONNXDetector("models/yolov8n.onnx")
        # Only allow class 0 (person), filter out car
        detector.configure(confidence=0.25, iou_threshold=0.45, enabled_classes=[0], img_size=640)

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        result = detector.detect(frame)
        for det in result.detections:
            assert det.class_id == 0
            assert det.class_name == "person"


def test_onnx_detector_real_file_inference():
    import os
    from vigilai_api.cv.detection.onnx_detector import ONNXDetector

    model_path = "models/yolov8n.onnx"
    if not os.path.exists(model_path):
        pytest.skip("models/yolov8n.onnx not present")

    detector = ONNXDetector(model_path, device="cpu")
    detector.warmup(1)
    frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    res = detector.detect(frame)
    assert isinstance(res, DetectionResult)
    assert res.inference_time_ms > 0
    assert res.frame_size == (640, 480)
