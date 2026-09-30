import {
  STATIC_TIME,
  entities,
  entityDistance,
  inFrame,
  pointAlong,
  virtualLine,
  zonePolygon,
  type Point,
  type SceneEntity,
} from './scene-model';

const W = 400;
const H = 300;
const TRAIL_DISTANCE = 0.34;
const px = ([u, v]: Point) => [u * W, v * H] as const;
const toPoints = (points: readonly Point[]) => points.map(p => px(p).join(',')).join(' ');

function trailFor(entity: SceneEntity, distance: number) {
  const points: Point[] = [];
  for (let step = 0; step <= 24; step += 1) {
    const point = pointAlong(entity.path, distance - TRAIL_DISTANCE + (TRAIL_DISTANCE * step) / 24);
    if (inFrame(point)) points.push(point);
  }
  return points;
}

function Brackets({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const s = 6;
  return (
    <path
      d={`M${x} ${y + s}V${y}H${x + s} M${x + w - s} ${y}H${x + w}V${y + s} M${x + w} ${y + h - s}V${y + h}H${x + w - s} M${x + s} ${y + h}H${x}V${y + h - s}`}
      fill="none"
      className="stroke-track"
      strokeWidth="2"
    />
  );
}

/**
 * Static, top-down rendering of the hero scene model. This is the no-JS,
 * reduced-motion and no-WebGL view, and it stays the accessible description
 * of the figure after the WebGL scene is loaded.
 */
export function TrackingSchematic({ className }: { className?: string }) {
  const snapshot = entities
    .map(entity => {
      const distance = entityDistance(entity, STATIC_TIME);
      if (distance === null) return null;
      const position = pointAlong(entity.path, distance);
      return inFrame(position) ? { entity, position, trail: trailFor(entity, distance) } : null;
    })
    .filter(item => item !== null);

  const [l0, l1] = virtualLine.map(px);
  const zoneLabel = px(zonePolygon[3]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="tracking-title tracking-description" className={className}>
      <title id="tracking-title">From persistent tracks to spatial events</title>
      <desc id="tracking-description">
        Illustration of a camera frame in normalized coordinates with a polygon zone, a virtual crossing line, and tracked objects
        with bounded trajectories. This is a diagram, not a live camera feed.
      </desc>
      <defs>
        <pattern id="schematic-grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M 25 0 H 0 V 25" fill="none" className="stroke-foreground" strokeOpacity=".08" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#schematic-grid)" />

      <polygon points={toPoints(zonePolygon)} className="fill-track/10 stroke-track" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={zoneLabel[0] + 6} y={zoneLabel[1] + 16} fontSize="12" className="fill-track-ink font-mono">ZONE</text>

      <line x1={l0[0]} y1={l0[1]} x2={l1[0]} y2={l1[1]} className="stroke-signal" strokeWidth="2.5" />
      {[l0, l1].map(([x, y]) => <rect key={`${x}`} x={x - 3.5} y={y - 3.5} width="7" height="7" className="fill-signal" />)}
      <text x={l0[0] + 4} y={l0[1] + 18} fontSize="12" className="fill-signal-ink font-mono">LINE</text>

      {snapshot.map(({ entity, position, trail }) => {
        const [x, y] = px(position);
        const [w, h] = entity.kind === 'person' ? [16, 38] : [46, 24];
        return (
          <g key={entity.key}>
            <polyline points={toPoints(trail)} fill="none" className="stroke-track" strokeOpacity=".7" strokeWidth="1.5" strokeDasharray="3 3" />
            <rect x={x - w / 2} y={y - h} width={w} height={h} fill="none" className="stroke-foreground" strokeOpacity=".35" />
            <Brackets x={x - w / 2 - 3} y={y - h - 3} w={w + 6} h={h + 6} />
            <circle cx={x} cy={y} r="2.5" className="fill-track" />
          </g>
        );
      })}

      <text x="22" y={H - 18} fontSize="12" className="fill-muted-foreground font-mono">x, y ∈ [0, 1]</text>
    </svg>
  );
}
