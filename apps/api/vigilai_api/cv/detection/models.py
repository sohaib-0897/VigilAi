from dataclasses import dataclass


@dataclass
class BBox:
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def center(self) -> tuple[float, float]:
        return (self.x1 + self.width / 2, self.y1 + self.height / 2)

    def to_xywh(self) -> tuple[float, float, float, float]:
        return (self.x1, self.y1, self.width, self.height)

    def to_normalized(self, frame_w: int, frame_h: int) -> "BBox":
        return BBox(
            x1=self.x1 / frame_w, y1=self.y1 / frame_h, x2=self.x2 / frame_w, y2=self.y2 / frame_h
        )

    def to_pixel(self, frame_w: int, frame_h: int) -> "BBox":
        return BBox(
            x1=self.x1 * frame_w, y1=self.y1 * frame_h, x2=self.x2 * frame_w, y2=self.y2 * frame_h
        )


@dataclass
class Detection:
    class_id: int
    class_name: str
    confidence: float
    bbox: BBox


@dataclass
class DetectionResult:
    detections: list[Detection]
    inference_time_ms: float
    frame_size: tuple[int, int]
