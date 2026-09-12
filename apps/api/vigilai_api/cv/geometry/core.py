from ..detection.models import BBox


def bbox_centroid(bbox: BBox) -> tuple[float, float]:
    return (bbox.x1 + bbox.width / 2.0, bbox.y1 + bbox.height / 2.0)


def point_in_polygon(point: tuple[float, float], polygon: list[tuple[float, float]]) -> bool:
    if len(polygon) < 3:
        return False
    x, y = point
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def validate_polygon(points: list[tuple[float, float]]) -> bool:
    import math

    if len(points) < 3 or len(set(points)) != len(points):
        return False
    if any(not math.isfinite(v) for p in points for v in p):
        return False
    n = len(points)
    area = sum(
        points[i][0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * points[i][1]
        for i in range(n)
    )
    if abs(area) < 1e-10:
        return False
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue
            if segments_intersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]):
                return False
    return True


def line_side(
    point: tuple[float, float], line_start: tuple[float, float], line_end: tuple[float, float]
) -> float:
    return (point[0] - line_start[0]) * (line_end[1] - line_start[1]) - (
        point[1] - line_start[1]
    ) * (line_end[0] - line_start[0])


def segments_intersect(p1: tuple, p2: tuple, p3: tuple, p4: tuple) -> bool:
    def ccw(A, B, C):
        return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])

    return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)


def detect_line_crossing(
    prev_point: tuple[float, float],
    curr_point: tuple[float, float],
    line_start: tuple[float, float],
    line_end: tuple[float, float],
) -> tuple[bool, str | None]:
    side_prev = line_side(prev_point, line_start, line_end)
    side_curr = line_side(curr_point, line_start, line_end)

    if segments_intersect(prev_point, curr_point, line_start, line_end):
        if side_prev < 0 and side_curr >= 0:
            return True, "a_to_b"
        elif side_prev > 0 and side_curr <= 0:
            return True, "b_to_a"
    return False, None


def normalize_point(x: float, y: float, frame_w: int, frame_h: int) -> tuple[float, float]:
    return (x / frame_w, y / frame_h)


def denormalize_point(x: float, y: float, frame_w: int, frame_h: int) -> tuple[float, float]:
    return (x * frame_w, y * frame_h)


def normalize_polygon(
    points: list[tuple[float, float]], frame_w: int, frame_h: int
) -> list[tuple[float, float]]:
    return [normalize_point(x, y, frame_w, frame_h) for x, y in points]


def denormalize_polygon(
    points: list[tuple[float, float]], frame_w: int, frame_h: int
) -> list[tuple[float, float]]:
    return [denormalize_point(x, y, frame_w, frame_h) for x, y in points]
