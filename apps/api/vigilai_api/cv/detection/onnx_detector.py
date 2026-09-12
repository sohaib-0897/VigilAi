import time

import cv2
import numpy as np

from .base import BaseDetector
from .models import BBox, Detection, DetectionResult

try:
    import onnxruntime as ort
except ImportError:
    ort = None


class ONNXDetector(BaseDetector):
    def __init__(self, model_path: str, device: str = "cpu", classes: dict[int, str] = None):
        if ort is None:
            raise RuntimeError("onnxruntime is not installed.")

        self._model_name = model_path
        self._device = device
        self._classes = classes or {
            0: "person",
            1: "bicycle",
            2: "car",
            3: "motorcycle",
            5: "bus",
            7: "truck",
        }

        providers = ["CPUExecutionProvider"]
        if device == "cuda":
            providers = ["CUDAExecutionProvider"] + providers

        self.session = ort.InferenceSession(model_path, providers=providers)
        self.input_name = self.session.get_inputs()[0].name

        self.conf = 0.25
        self.iou = 0.45
        self.enabled_classes = list(self._classes.keys())
        self.img_size = 640

    def detect(self, frame: np.ndarray) -> DetectionResult:
        start_t = time.perf_counter()

        h, w = frame.shape[:2]
        scale = min(self.img_size / w, self.img_size / h)
        resized_w, resized_h = round(w * scale), round(h * scale)
        left = round((self.img_size - resized_w) / 2 - 0.1)
        top = round((self.img_size - resized_h) / 2 - 0.1)
        img = np.full((self.img_size, self.img_size, 3), 114, dtype=np.uint8)
        img[top : top + resized_h, left : left + resized_w] = cv2.resize(
            frame, (resized_w, resized_h)
        )
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.transpose((2, 0, 1))[np.newaxis, :, :, :] / 255.0
        img = img.astype(np.float32)

        outputs = self.session.run(None, {self.input_name: img})[0]

        # Simplified post-processing assuming YOLOv8 ONNX format output (batch, 4+classes, anchors)
        outputs = np.transpose(np.squeeze(outputs))  # (anchors, 4+classes)

        boxes = outputs[:, :4]
        scores = outputs[:, 4:]

        class_ids = np.argmax(scores, axis=1)
        confidences = np.max(scores, axis=1)

        mask = confidences > self.conf
        boxes = boxes[mask]
        class_ids = class_ids[mask]
        confidences = confidences[mask]

        # Convert xywh to xyxy
        x_c, y_c, w_b, h_b = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
        boxes = np.stack([x_c - w_b / 2, y_c - h_b / 2, x_c + w_b / 2, y_c + h_b / 2], axis=1)

        # Rescale boxes back to original image size
        boxes[:, [0, 2]] = np.clip((boxes[:, [0, 2]] - left) / scale, 0, w)
        boxes[:, [1, 3]] = np.clip((boxes[:, [1, 3]] - top) / scale, 0, h)

        xywh = boxes.copy()
        xywh[:, 2:] -= xywh[:, :2]
        indices = []
        for class_id in np.unique(class_ids):
            candidates = np.flatnonzero(class_ids == class_id)
            kept = cv2.dnn.NMSBoxes(
                xywh[candidates].tolist(), confidences[candidates].tolist(), self.conf, self.iou
            )
            if len(kept):
                indices.extend(candidates[np.asarray(kept).flatten()].tolist())

        detections = []
        if len(indices) > 0:
            for idx in indices:
                cls_id = int(class_ids[idx])
                if self.enabled_classes is None or cls_id in self.enabled_classes:
                    x1, y1, x2, y2 = boxes[idx]
                    detections.append(
                        Detection(
                            class_id=cls_id,
                            class_name=self._classes.get(cls_id, str(cls_id)),
                            confidence=float(confidences[idx]),
                            bbox=BBox(x1=float(x1), y1=float(y1), x2=float(x2), y2=float(y2)),
                        )
                    )

        inference_time_ms = (time.perf_counter() - start_t) * 1000
        return DetectionResult(
            detections=detections, inference_time_ms=inference_time_ms, frame_size=(w, h)
        )

    def warmup(self, n: int = 3) -> None:
        dummy_frame = np.zeros((self.img_size, self.img_size, 3), dtype=np.uint8)
        for _ in range(n):
            self.detect(dummy_frame)

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def device(self) -> str:
        return self._device

    @property
    def classes(self) -> dict[int, str]:
        return self._classes

    def configure(
        self,
        confidence: float,
        iou_threshold: float,
        enabled_classes: list[int] | None,
        img_size: int,
    ) -> None:
        self.conf = confidence
        self.iou = iou_threshold
        self.enabled_classes = enabled_classes
        self.img_size = img_size
