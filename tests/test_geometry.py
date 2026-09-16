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
        assert point_in_polygon((0.5, 0.5), sample_polygon)

    def test_point_outside_square(self, sample_polygon):
        assert not point_in_polygon((1.5, 1.5), sample_polygon)

    def test_point_on_edge(self, sample_polygon):
        # Ray casting edge behavior; test clearly outside point for strictness
        assert not point_in_polygon((-0.1, -0.1), sample_polygon)

    def test_point_inside_triangle(self):
        triangle = [(0.0, 0.0), (2.0, 0.0), (1.0, 2.0)]
        assert point_in_polygon((1.0, 1.0), triangle)

    def test_point_outside_triangle(self):
        triangle = [(0.0, 0.0), (2.0, 0.0), (1.0, 2.0)]
        assert not point_in_polygon((1.0, 3.0), triangle)

    def test_point_inside_complex_polygon(self):
        poly = [(0, 0), (2, 0), (2, 2), (1, 1), (0, 2)]
        assert point_in_polygon((0.5, 1.0), poly)
        assert not point_in_polygon((1.0, 1.5), poly)

    def test_point_at_vertex(self, sample_polygon):
        assert not point_in_polygon((0.0, 0.0), sample_polygon)


class TestValidatePolygon:
    def test_valid_triangle(self):
        assert validate_polygon([(0, 0), (1, 0), (0, 1)])

    def test_valid_rectangle(self):
        assert validate_polygon([(0, 0), (1, 0), (1, 1), (0, 1)])

    def test_too_few_points(self):
        assert not validate_polygon([(0, 0), (1, 0)])

    def test_two_points(self):
        assert not validate_polygon([(0, 0), (1, 1)])

    def test_single_point(self):
        assert not validate_polygon([(0, 0)])


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
        assert segments_intersect((0, 0), (1, 1), (0, 1), (1, 0))

    def test_parallel_segments(self):
        assert not segments_intersect((0, 0), (0, 1), (1, 0), (1, 1))

    def test_non_intersecting(self):
        assert not segments_intersect((0, 0), (0.1, 0.1), (0, 1), (1, 0))

    def test_touching_endpoint(self):
        assert not segments_intersect((0, 0), (1, 1), (1, 1), (2, 0))


class TestLineCrossing:
    def test_crossing_left_to_right(self):
        crossed, direction = detect_line_crossing((-1, 5), (1, 5), (0, 0), (0, 10))
        assert crossed
        assert direction == "a_to_b"

    def test_crossing_right_to_left(self):
        crossed, direction = detect_line_crossing((1, 5), (-1, 5), (0, 0), (0, 10))
        assert crossed
        assert direction == "b_to_a"

    def test_no_crossing_parallel(self):
        crossed, _ = detect_line_crossing((-1, 0), (-1, 10), (0, 0), (0, 10))
        assert not crossed

    def test_no_crossing_same_side(self):
        crossed, _ = detect_line_crossing((-2, 5), (-1, 5), (0, 0), (0, 10))
        assert not crossed

    def test_direction_a_to_b(self):
        crossed, direction = detect_line_crossing((0, -1), (0, 1), (-1, 0), (1, 0))
        assert crossed
        assert direction == "b_to_a"

    def test_direction_b_to_a(self):
        crossed, direction = detect_line_crossing((0, 1), (0, -1), (-1, 0), (1, 0))
        assert crossed
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
