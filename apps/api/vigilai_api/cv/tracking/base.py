from abc import ABC, abstractmethod

import numpy as np

from ..detection.models import Detection
from .models import TrackingResult


class BaseTracker(ABC):
    @abstractmethod
    def update(
        self, detections: list[Detection], frame: np.ndarray | None = None
    ) -> TrackingResult:
        pass

    @abstractmethod
    def reset(self) -> None:
        pass

    @property
    @abstractmethod
    def active_tracks(self) -> int:
        pass

    @property
    @abstractmethod
    def total_tracks_created(self) -> int:
        pass
