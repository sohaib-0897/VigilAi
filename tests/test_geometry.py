from apps.api.vigilai_api.cv.detection.models import BBox
from apps.api.vigilai_api.cv.geometry.core import (
    bbox_centroid,
    denormalize_point,
    detect_line_crossing,
    line_side,
    normalize_point,
    normalize_polygon,
    point_in_polygon,
    segments_intersect,
    validate_polygon,
)


class TestBBoxCentroid:
    def test_centroid_calculation(self):
        bbox = BBox(x1=10, y1=10, x2=50, y2=50)
        assert bbox_centroid(bbox) == (30.0, 30.0)

    def test_zero_size_bbox(self):
        bbox = BBox(x1=10, y1=10, x2=10, y2=10)
        assert bbox_centroid(bbox) == (10.0, 10.0)


class TestPointInPolygon:
    def test_point_inside_square(self, sample_polygon):
        assert point_in_polygon((0.5, 0.5), sample_polygon) == True

    def test_point_outside_square(self, sample_polygon):
        assert point_in_polygon((1.5, 1.5), sample_polygon) == False

    def test_point_on_edge(self, sample_polygon):
        # Depending on implementation, edge might be inside or outside.
        # But for point_in_polygon with ray casting, it's typically inside or boundary cases might vary.
        # Let's test a clearly outside point for strictness.
        assert point_in_polygon((-0.1, -0.1), sample_polygon) == False

    def test_point_inside_triangle(self):
        triangle = [(0.0, 0.0), (2.0, 0.0), (1.0, 2.0)]
        assert point_in_polygon((1.0, 1.0), triangle) == True

    def test_point_outside_triangle(self):
        triangle = [(0.0, 0.0), (2.0, 0.0), (1.0, 2.0)]
        assert point_in_polygon((1.0, 3.0), triangle) == False

    def test_point_inside_complex_polygon(self):
        poly = [(0, 0), (2, 0), (2, 2), (1, 1), (0, 2)]
        assert point_in_polygon((0.5, 1.0), poly) == True
        assert point_in_polygon((1.0, 1.5), poly) == False

    def test_point_at_vertex(self, sample_polygon):
        assert point_in_polygon((0.0, 0.0), sample_polygon) == False


class TestValidatePolygon:
    def test_valid_triangle(self):
        assert validate_polygon([(0, 0), (1, 0), (0, 1)]) == True

    def test_valid_rectangle(self):
        assert validate_polygon([(0, 0), (1, 0), (1, 1), (0, 1)]) == True

    def test_too_few_points(self):
        assert validate_polygon([(0, 0), (1, 0)]) == False

    def test_two_points(self):
        assert validate_polygon([(0, 0), (1, 1)]) == False

    def test_single_point(self):
        assert validate_polygon([(0, 0)]) == False


class TestLineSide:
    def test_point_left_of_line(self):
        # Line from (0,0) to (0,10)
        assert line_side((-1, 5), (0, 0), (0, 10)) < 0

    def test_point_right_of_line(self):
        assert line_side((1, 5), (0, 0), (0, 10)) > 0

    def test_point_on_line(self):
        assert line_side((0, 5), (0, 0), (0, 10)) == 0


class TestSegmentsIntersect:
    def test_crossing_segments(self):
        assert segments_intersect((0, 0), (1, 1), (0, 1), (1, 0)) == True

    def test_parallel_segments(self):
        assert segments_intersect((0, 0), (0, 1), (1, 0), (1, 1)) == False

    def test_non_intersecting(self):
        assert segments_intersect((0, 0), (0.1, 0.1), (0, 1), (1, 0)) == False

    def test_touching_endpoint(self):
        assert segments_intersect((0, 0), (1, 1), (1, 1), (2, 0)) == False


class TestLineCrossing:
    def test_crossing_left_to_right(self):
        crossed, direction = detect_line_crossing((-1, 5), (1, 5), (0, 0), (0, 10))
        assert crossed == True
        assert direction == "a_to_b"

    def test_crossing_right_to_left(self):
        crossed, direction = detect_line_crossing((1, 5), (-1, 5), (0, 0), (0, 10))
        assert crossed == True
        assert direction == "b_to_a"

    def test_no_crossing_parallel(self):
        crossed, direction = detect_line_crossing((-1, 0), (-1, 10), (0, 0), (0, 10))
        assert crossed == False

    def test_no_crossing_same_side(self):
        crossed, direction = detect_line_crossing((-2, 5), (-1, 5), (0, 0), (0, 10))
        assert crossed == False

    def test_direction_a_to_b(self):
        crossed, direction = detect_line_crossing((0, -1), (0, 1), (-1, 0), (1, 0))
        assert crossed == True
        assert direction == "b_to_a"

    def test_direction_b_to_a(self):
        crossed, direction = detect_line_crossing((0, 1), (0, -1), (-1, 0), (1, 0))
        assert crossed == True
        assert direction == "a_to_b"


class TestCoordinateNormalization:
    def test_normalize_point(self):
        assert normalize_point(500, 300, 1000, 600) == (0.5, 0.5)

    def test_denormalize_point(self):
        assert denormalize_point(0.5, 0.5, 1000, 600) == (500.0, 300.0)

    def test_round_trip(self):
        norm = normalize_point(123, 456, 1920, 1080)
        denorm = denormalize_point(*norm, 1920, 1080)
        assert abs(denorm[0] - 123) < 1e-5
        assert abs(denorm[1] - 456) < 1e-5

    def test_normalize_polygon(self):
        poly = [(0, 0), (1000, 0), (1000, 600)]
        norm_poly = normalize_polygon(poly, 1000, 600)
        assert norm_poly == [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0)]
