import cv2
import numpy as np

from .analytics.counting import CountingState
from .tracking.models import Track


class FrameAnnotator:
    def annotate(
        self,
        frame: np.ndarray,
        tracks: list[Track],
        zones: dict[str, list[tuple[float, float]]] | None = None,
        lines: dict[str, tuple] | None = None,
        counts: CountingState | None = None,
        fps: float | None = None,
    ) -> np.ndarray:
        img = frame.copy()
        h, w = img.shape[:2]

        if zones:
            for z_id, pts in zones.items():
                pts_arr = np.array([(x * w, y * h) for x, y in pts], np.int32).reshape((-1, 1, 2))
                cv2.polylines(img, [pts_arr], True, (255, 255, 0), 2)
                cv2.putText(
                    img, z_id, tuple(pts_arr[0][0]), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1
                )

        if lines:
            for l_id, (start, end, mode) in lines.items():
                pt1, pt2 = (
                    (int(start[0] * w), int(start[1] * h)),
                    (int(end[0] * w), int(end[1] * h)),
                )
                cv2.line(img, pt1, pt2, (255, 0, 255), 2)
                cv2.putText(img, l_id, pt1, cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 1)

        for t in tracks:
            x1, y1, x2, y2 = map(int, [t.bbox.x1, t.bbox.y1, t.bbox.x2, t.bbox.y2])
            color = (0, 255, 0)
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            label = f"{t.class_name} {t.confidence:.2f} #{t.track_id}"
            cv2.putText(img, label, (x1, max(0, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            if len(t.trajectory) > 1:
                traj_pts = np.array(t.trajectory, np.int32).reshape((-1, 1, 2))
                cv2.polylines(img, [traj_pts], False, (0, 165, 255), 2)

        if fps is not None:
            cv2.putText(
                img, f"FPS: {fps:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2
            )

        if counts:
            y_offset = 60
            cv2.putText(
                img,
                f"Total Objs: {counts.current_object_count}",
                (10, y_offset),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2,
            )
            y_offset += 25
            for cls_name, c in counts.class_counts.items():
                cv2.putText(
                    img,
                    f"{cls_name}: {c}",
                    (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (200, 200, 200),
                    1,
                )
                y_offset += 25

        return img
