/**
 * Deterministic model behind the landing hero illustration. It shares one scene
 * description between the static SVG schematic and the WebGL scene, so both
 * show the same geometry.
 *
 * Coordinates are normalized frame coordinates, matching how VigilAI persists
 * camera geometry: u → right, v → down, both in [0, 1]. Nothing here is camera
 * data. The entity paths are hand-authored for illustration only.
 */

export type Point = readonly [number, number];

export type SceneEntity = {
  key: string;
  kind: 'person' | 'vehicle';
  /** Polyline in normalized coordinates. It may start or end outside [0,1]. */
  path: readonly Point[];
  /** Normalized units per second. */
  speed: number;
  /** Seconds added to the loop clock so entities do not move in lockstep. */
  offset: number;
};

export const zonePolygon: readonly Point[] = [[0.56, 0.16], [0.9, 0.22], [0.84, 0.6], [0.52, 0.54]];

export const virtualLine: readonly [Point, Point] = [[0.06, 0.74], [0.5, 0.5]];

export const entities: readonly SceneEntity[] = [
  { key: 'a', kind: 'person', path: [[0.14, 1.08], [0.22, 0.8], [0.36, 0.62], [0.58, 0.44], [0.74, 0.34], [1.08, 0.18]], speed: 0.085, offset: 0 },
  { key: 'b', kind: 'person', path: [[0.98, 1.08], [0.8, 0.74], [0.7, 0.42], [0.64, 0.08], [0.6, -0.08]], speed: 0.07, offset: 6.5 },
  { key: 'c', kind: 'vehicle', path: [[-0.12, 0.9], [0.3, 0.84], [0.62, 0.8], [1.12, 0.66]], speed: 0.12, offset: 3 },
];

/** Moment used for the static schematic: entities are drawn where they are at this loop time. */
export const STATIC_TIME = 7.2;

/** Pause, in seconds, between one pass of an entity and the next. */
const LOOP_GAP = 2.5;

export const TRAIL_LENGTH = 48;

function segmentLengths(path: readonly Point[]) {
  const lengths: number[] = [];
  for (let i = 1; i < path.length; i += 1) {
    lengths.push(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  return lengths;
}

export function pathLength(path: readonly Point[]) {
  return segmentLengths(path).reduce((sum, length) => sum + length, 0);
}

/** Point at arc-length `distance` along `path`, clamped to its ends. */
export function pointAlong(path: readonly Point[], distance: number): Point {
  const lengths = segmentLengths(path);
  let remaining = Math.max(0, distance);
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] === 0 ? 0 : remaining / lengths[i];
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
    }
    remaining -= lengths[i];
  }
  return path[path.length - 1];
}

/** Arc-length position of an entity at `time`, or `null` during the gap between passes. */
export function entityDistance(entity: SceneEntity, time: number): number | null {
  const travel = pathLength(entity.path) / entity.speed;
  const cycle = travel + LOOP_GAP;
  const local = (((time + entity.offset) % cycle) + cycle) % cycle;
  return local <= travel ? local * entity.speed : null;
}

export const inFrame = ([u, v]: Point) => u >= 0 && u <= 1 && v >= 0 && v <= 1;

/** Even-odd ray cast. Points on an edge may resolve either way; this is illustration only. */
export function pointInPolygon([x, y]: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Sign of the cross product: which side of the directed segment the point lies on. */
export function lineSide([x, y]: Point, [[ax, ay], [bx, by]]: readonly [Point, Point]) {
  return Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
}

/** True when the move `from → to` crosses the finite segment `line`. */
export function crossesSegment(from: Point, to: Point, line: readonly [Point, Point]) {
  const a = lineSide(from, line);
  const b = lineSide(to, line);
  if (a === 0 || b === 0 || a === b) return false;
  return lineSide(line[0], [from, to]) !== lineSide(line[1], [from, to]);
}
