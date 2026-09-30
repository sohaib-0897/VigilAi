import type { Point } from '@/lib/types';

/**
 * Pure coordinate helpers for the camera overlay editor. Geometry is persisted
 * normalised to the *source frame* (x, y ∈ [0, 1]); pixels only exist at render
 * time. Mirrors `vigilai_api/cv/geometry/core.py` where the backend validates.
 */

export interface Size { width: number; height: number; }
export interface Rect { left: number; top: number; width: number; height: number; }

export const DEFAULT_ASPECT: Size = { width: 16, height: 9 };

const PRECISION = 10_000;
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const round4 = (value: number) => Math.round(value * PRECISION) / PRECISION;

/** Where a `srcW×srcH` frame lands inside a `box` under `object-fit: contain` (letterboxing). */
export function fitContain(box: Rect, source: Size): Rect {
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
  };
}

/**
 * Browser client coordinates → normalised source coordinates. Returns `null`
 * for points in the letterbox bars, so they can never be persisted.
 */
export function clientToNormalized(clientX: number, clientY: number, box: Rect, source: Size): Point | null {
  const content = fitContain(box, source);
  if (content.width <= 0 || content.height <= 0) return null;
  const x = (clientX - content.left) / content.width;
  const y = (clientY - content.top) / content.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: round4(x), y: round4(y) };
}

/** Same sign convention as the worker: negative = side A, positive = side B. */
export function lineSide(point: Point, start: Point, end: Point): number {
  return (point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x);
}

/**
 * Label anchors on each side of a line. The worker reports `a_to_b` when a
 * track moves from negative to positive `lineSide`; in image coordinates side A
 * is on the right-hand side when facing from start to end.
 */
export function sideAnchors(start: Point, end: Point, offset = 0.05): { a: Point; b: Point } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  // (dy, -dx) points towards positive lineSide (side B).
  const nx = (dy / length) * offset;
  const ny = (-dx / length) * offset;
  return {
    a: { x: clamp01(mid.x - nx), y: clamp01(mid.y - ny) },
    b: { x: clamp01(mid.x + nx), y: clamp01(mid.y + ny) },
  };
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (a: Point, b: Point, c: Point) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/** Human-readable reason a polygon would be rejected by the API, or `null` if valid. */
export function polygonIssue(points: Point[]): string | null {
  if (points.length < 3) return `A zone needs at least 3 points (${points.length} placed).`;
  const keys = new Set(points.map(p => `${p.x},${p.y}`));
  if (keys.size !== points.length) return 'Two points are identical. Remove the duplicate.';
  const n = points.length;
  // Checked before area: a symmetric bow-tie also has zero signed area, and "crosses itself" is the useful message.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) {
        return 'The outline crosses itself. Reorder or remove points.';
      }
    }
  }
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(area) < 1e-10) return 'The points are collinear, so the zone has no area.';
  return null;
}

export function lineIssue(points: Point[]): string | null {
  if (points.length < 2) return `A line needs a start and an end point (${points.length} placed).`;
  if (points[0].x === points[1].x && points[0].y === points[1].y) return 'Start and end are the same point.';
  return null;
}

export const formatPoint = (p: Point) => `${p.x.toFixed(4)}, ${p.y.toFixed(4)}`;
