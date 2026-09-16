import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from ..events.manager import EventRecord
from ..tracking.models import Track


@dataclass
class EvidenceMetadata:
    file_path: str
    file_size: int
    mime_type: str
    width: int
    height: int
    timestamp: float
    event_id: str


class EvidenceCapture:
    def __init__(self, evidence_dir: str):
        self._evidence_dir = Path(evidence_dir)
        self._evidence_dir.mkdir(parents=True, exist_ok=True)

    def capture_snapshot(
        self,
        frame: np.ndarray,
        event: EventRecord,
        tracks: list[Track],
        zones: dict[str, list[tuple[float, float]]] | None = None,
        lines: dict[str, tuple] | None = None,
    ) -> EvidenceMetadata:
        img = frame.copy()
        h, w = img.shape[:2]

        if zones and event.zone_id in zones:
            pts = np.array([(x * w, y * h) for x, y in zones[event.zone_id]], np.int32)
            pts = pts.reshape((-1, 1, 2))
            cv2.polylines(img, [pts], True, (0, 0, 255), 2)

        if lines and event.line_id in lines:
            start, end, _ = lines[event.line_id]
            cv2.line(
                img,
                (int(start[0] * w), int(start[1] * h)),
                (int(end[0] * w), int(end[1] * h)),
                (255, 0, 0),
                2,
            )

        for t in tracks:
            if t.track_id == event.track_id:
                x1, y1, x2, y2 = map(int, [t.bbox.x1, t.bbox.y1, t.bbox.x2, t.bbox.y2])
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 255), 2)
                cv2.putText(
                    img,
                    f"{t.class_name} #{t.track_id}",
                    (x1, max(0, y1 - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 255, 255),
                    1,
                )

        cv2.putText(
            img,
            f"Event: {event.event_type} | Time: {event.started_at:.2f}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255),
            2,
        )

        file_path = self._evidence_dir / f"ev_{event.event_id}.jpg"
        if not cv2.imwrite(str(file_path), img):
            raise OSError("Snapshot write failed")

        return EvidenceMetadata(
            file_path=str(file_path),
            file_size=os.path.getsize(file_path),
            mime_type="image/jpeg",
            width=w,
            height=h,
            timestamp=event.started_at,
            event_id=event.event_id,
        )
