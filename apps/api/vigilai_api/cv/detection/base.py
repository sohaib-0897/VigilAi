from abc import ABC, abstractmethod

import numpy as np

from .models import DetectionResult


class BaseDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray) -> DetectionResult:
        pass

    @abstractmethod
    def warmup(self, n: int = 3) -> None:
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        pass

    @property
    @abstractmethod
    def device(self) -> str:
        pass

    @property
    @abstractmethod
    def classes(self) -> dict[int, str]:
        pass

    @abstractmethod
    def configure(
        self,
        confidence: float,
        iou_threshold: float,
        enabled_classes: list[int] | None,
        img_size: int,
    ) -> None:
        pass
