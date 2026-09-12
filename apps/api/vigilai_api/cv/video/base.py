from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class VideoMetadata:
    width: int
    height: int
    fps: float
    total_frames: int
    codec: str


class VideoSource(ABC):
    @abstractmethod
    def open(self) -> bool:
        pass

    @abstractmethod
    def read(self) -> tuple[bool, np.ndarray | None]:
        pass

    @abstractmethod
    def is_open(self) -> bool:
        pass

    @abstractmethod
    def close(self) -> None:
        pass

    @abstractmethod
    def reconnect(self) -> bool:
        pass

    @abstractmethod
    def metadata(self) -> VideoMetadata:
        pass

    @property
    @abstractmethod
    def source_type(self) -> str:
        pass

    @property
    @abstractmethod
    def source_uri(self) -> str:
        pass
