import threading
import time

import numpy as np
from ultralytics import YOLO

from .base import BaseDetector
from .models import BBox, Detection, DetectionResult


class YOLODetector(BaseDetector):
    def __init__(self, model_path: str = "yolov8n.pt", device: str = "cpu"):
        self._lock = threading.Lock()
        self._model_name = model_path
        self._device = device
        try:
            self.model = YOLO(model_path)
            self.model.to(device)
        except Exception as e:
            raise RuntimeError(f"Failed to load YOLO model {model_path}: {e}")

        self.conf = 0.25
        self.iou = 0.45
        self.enabled_classes = [0, 1, 2, 3, 5, 7]
        self.img_size = 640

    def detect(self, frame: np.ndarray) -> DetectionResult:
        with self._lock:
            return self._detect(frame)

    def _detect(self, frame: np.ndarray) -> DetectionResult:
        start_t = time.perf_counter()

        results = self.model(
            frame,
            conf=self.conf,
            iou=self.iou,
            classes=self.enabled_classes,
            imgsz=self.img_size,
            verbose=False,
            device=self._device,
        )

        inference_time_ms = (time.perf_counter() - start_t) * 1000

        detections = []
        if len(results) > 0:
            result = results[0]
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())

                    if self.enabled_classes is None or cls_id in self.enabled_classes:
                        cls_name = self.classes.get(cls_id, str(cls_id))
                        detections.append(
                            Detection(
                                class_id=cls_id,
                                class_name=cls_name,
                                confidence=conf,
                                bbox=BBox(x1=float(x1), y1=float(y1), x2=float(x2), y2=float(y2)),
                            )
                        )

        return DetectionResult(
            detections=detections,
            inference_time_ms=inference_time_ms,
            frame_size=(frame.shape[1], frame.shape[0]),
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
        return self.model.names

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
