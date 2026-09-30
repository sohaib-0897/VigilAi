'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, Undo2, X } from 'lucide-react';
import type { Point, VirtualLine, Zone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewportFrame } from '@/components/primitives/viewport-frame';
import { ActionAlert } from '@/components/console/feedback';
import { DIRECTION_LABELS, errorMessage, humanize } from './camera-format';
import {
  DEFAULT_ASPECT,
  clamp01,
  clientToNormalized,
  formatPoint,
  lineIssue,
  polygonIssue,
  round4,
  sideAnchors,
  type Size,
} from './overlay-geometry';

export type Mode = 'zone' | 'line';

export interface ZoneDraft { name: string; zone_type: string; points: Point[]; color: string; }
export interface LineDraft { name: string; direction_mode: string; start_point: Point; end_point: Point; color: string; }

interface GeometryEditorProps {
  zones: Zone[];
  lines: VirtualLine[];
  /** MJPEG URL while the camera is online, otherwise `null` (no reference frame). */
  streamUrl: string | null;
  /** Source frame size from the camera record, when known. */
  sourceSize: Size | null;
  onCreateZone: (draft: ZoneDraft) => Promise<void>;
  onCreateLine: (draft: LineDraft) => Promise<void>;
}

export const ZONE_TYPES = ['custom', 'restricted', 'entrance', 'exit', 'parking', 'pedestrian', 'loading'];
// Mirrors of the --track and --signal tokens; persisted as hex because the worker draws with them.
const NEW_ZONE_COLOR = '#4FD1EA';
const NEW_LINE_COLOR = '#D2FF3A';
const DRAFT_COLOR = '#D2FF3A';
const HALO = '#0E0F11';

type FrameState = 'none' | 'loading' | 'live' | 'error';

export function GeometryEditor({ zones, lines, streamUrl, sourceSize, onCreateZone, onCreateLine }: GeometryEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [mode, setMode] = useState<Mode>('zone');
  const [draft, setDraft] = useState<Point[]>([]);
  const [name, setName] = useState('');
  const [zoneType, setZoneType] = useState('custom');
  const [direction, setDirection] = useState('both');
  const [xInput, setXInput] = useState('');
  const [yInput, setYInput] = useState('');
  const [entryError, setEntryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [cursor, setCursor] = useState<Point | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [frameState, setFrameState] = useState<FrameState>(streamUrl ? 'loading' : 'none');
  const [frameAttempt, setFrameAttempt] = useState(0);

  useEffect(() => {
    setFrameState(streamUrl ? 'loading' : 'none');
  }, [streamUrl, frameAttempt]);

  // An MJPEG <img> may not fire `load` per frame in every browser; poll for the first decoded frame.
  useEffect(() => {
    if (!streamUrl || frameState !== 'loading') return;
    let tries = 0;
    const interval = setInterval(() => {
      const img = imgRef.current;
      tries += 1;
      if (img && img.naturalWidth > 0) {
        setNatural({ width: img.naturalWidth, height: img.naturalHeight });
        setFrameState('live');
      }
      if (tries > 40 || (img && img.naturalWidth > 0)) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [streamUrl, frameState]);

  const source = natural ?? sourceSize ?? DEFAULT_ASPECT;
  const sizeKnown = Boolean(natural ?? sourceSize);
  const maxPoints = mode === 'line' ? 2 : Infinity;
  const issue = mode === 'zone' ? polygonIssue(draft) : lineIssue(draft);
  const canSave = !issue && name.trim().length > 0 && !saving;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setDraft([]);
    setName('');
    setEntryError(null);
    setSaveError(null);
    setAnnouncement(`${next === 'zone' ? 'Zone' : 'Line'} mode. Draft cleared.`);
  };

  const addPoint = (point: Point) => {
    if (draft.length >= maxPoints) {
      setEntryError('This line already has a start and an end. Remove a point to move it.');
      return;
    }
    const next = [...draft, point];
    setDraft(next);
    setEntryError(null);
    setAnnouncement(`${pointName(mode, next.length - 1)} placed at ${formatPoint(point)}.`);
  };

  const removePoint = (index: number) => {
    setDraft(d => d.filter((_, i) => i !== index));
    setEntryError(null);
    setAnnouncement(`${pointName(mode, index)} removed.`);
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const point = clientToNormalized(e.clientX, e.clientY, stage.getBoundingClientRect(), source);
    if (point) addPoint(point);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    setCursor(clientToNormalized(e.clientX, e.clientY, stage.getBoundingClientRect(), source));
  };

  const handleCoordinateAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const x = Number.parseFloat(xInput);
    const y = Number.parseFloat(yInput);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
      setEntryError('Enter X and Y between 0 and 1.');
      return;
    }
    addPoint({ x: round4(clamp01(x)), y: round4(clamp01(y)) });
    setXInput('');
    setYInput('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const label = name.trim();
    try {
      if (mode === 'zone') {
        await onCreateZone({ name: label, zone_type: zoneType, points: draft, color: NEW_ZONE_COLOR });
      } else {
        await onCreateLine({ name: label, direction_mode: direction, start_point: draft[0], end_point: draft[1], color: NEW_LINE_COLOR });
      }
      setDraft([]);
      setName('');
      setAnnouncement(`${mode === 'zone' ? 'Zone' : 'Line'} “${label}” saved.`);
    } catch (cause) {
      setSaveError(errorMessage(cause, 'The geometry could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const draftAnchors = mode === 'line' && draft.length === 2 ? sideAnchors(draft[0], draft[1]) : null;
  const stageLabel = `Reference frame with ${zones.length} saved ${zones.length === 1 ? 'zone' : 'zones'}, ${lines.length} saved ${lines.length === 1 ? 'line' : 'lines'} and a draft of ${draft.length} ${draft.length === 1 ? 'point' : 'points'}.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Drawing mode" className="inline-grid grid-cols-2 border border-border-strong">
          {(['zone', 'line'] as const).map(m => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                'vg-label min-h-11 px-4 transition-colors duration-micro ease-standard focus-visible:outline-offset-[-3px]',
                mode === m ? 'bg-foreground text-background' : 'bg-surface text-foreground hover:bg-muted',
              )}
            >
              {m === 'zone' ? 'Draw zone' : 'Draw line'}
            </button>
          ))}
        </div>
        <p className="text-body-sm text-muted-foreground">
          {mode === 'zone'
            ? 'Click the frame to place at least 3 points, or enter coordinates below.'
            : 'Click the frame to place a start and an end point, or enter coordinates below.'}
        </p>
      </div>

      <div className="surface-optical">
        <ViewportFrame
          as="figure"
          aria-label="Zone and line overlay editor"
          brackets={false}
          label="Reference frame"
          meta={
            <>
              <span className="vg-telemetry">
                {frameState === 'live' ? 'LIVE STREAM' : frameState === 'loading' ? 'WAITING FOR FRAME' : frameState === 'error' ? 'STREAM FAILED' : 'NO FRAME'}
              </span>
              {frameState === 'error' && (
                <button type="button" onClick={() => setFrameAttempt(a => a + 1)} className="vg-label min-h-11 px-1 underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-8">
                  Retry
                </button>
              )}
            </>
          }
          footer={
            <>
              <span className="truncate">
                {natural ? `SOURCE ${natural.width}×${natural.height}` : sourceSize ? `SOURCE ${sourceSize.width}×${sourceSize.height}` : 'ASPECT 16:9 ASSUMED'}
              </span>
              <span className="shrink-0 tabular" aria-hidden="true">
                {cursor ? `X ${cursor.x.toFixed(4)} · Y ${cursor.y.toFixed(4)}` : 'NORMALISED 0–1'}
              </span>
            </>
          }
        >
          {/* In normal flow above the stage, so it never covers geometry on small screens. */}
          {frameState !== 'live' && (
            <p className="border-b border-border px-3 py-2 text-body-sm text-muted-foreground">
              {frameState === 'none' && 'No reference frame: the camera is not streaming. Start analytics on the live view to draw against the image. Coordinates are still normalised to the frame.'}
              {frameState === 'loading' && 'Waiting for the first frame from the worker…'}
              {frameState === 'error' && 'The stream could not be loaded. Points can still be placed; use Retry to reload the frame.'}
            </p>
          )}
          <div
            ref={stageRef}
            role="img"
            aria-label={stageLabel}
            data-testid="geometry-stage"
            onClick={handleStageClick}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setCursor(null)}
            style={{ aspectRatio: `${source.width} / ${source.height}` }}
            className={cn('relative w-full cursor-crosshair select-none overflow-hidden bg-background', frameState !== 'live' && 'bg-tech-grid')}
          >
            {streamUrl && frameState !== 'error' && (
              // eslint-disable-next-line @next/next/no-img-element -- MJPEG multipart stream; next/image cannot proxy it.
              <img
                key={frameAttempt}
                ref={imgRef}
                src={streamUrl}
                alt=""
                draggable={false}
                onLoad={e => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0) {
                    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
                    setFrameState('live');
                  }
                }}
                onError={() => setFrameState('error')}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            )}

            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {zones.map(zone => (
                <g key={zone.id}>
                  <polygon points={svgPoints(zone.points)} fill="none" stroke={HALO} strokeOpacity={0.7} strokeWidth={4} vectorEffect="non-scaling-stroke" />
                  <polygon points={svgPoints(zone.points)} fill={zone.color} fillOpacity={0.16} stroke={zone.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
              {lines.map(line => (
                <g key={line.id}>
                  <line {...lineProps(line.start_point, line.end_point)} stroke={HALO} strokeOpacity={0.7} strokeWidth={5} vectorEffect="non-scaling-stroke" />
                  <line {...lineProps(line.start_point, line.end_point)} stroke={line.color} strokeWidth={3} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
              {draft.length > 1 && (
                <>
                  <polyline points={svgPoints(draft)} fill="none" stroke={HALO} strokeWidth={5} vectorEffect="non-scaling-stroke" />
                  <polyline points={svgPoints(draft)} fill="none" stroke={DRAFT_COLOR} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                </>
              )}
              {mode === 'zone' && draft.length > 2 && (
                <polygon points={svgPoints(draft)} fill={DRAFT_COLOR} fillOpacity={0.14} stroke={DRAFT_COLOR} strokeOpacity={0.55} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {/* HTML labels and handles, positioned in % so they are never stretched by the SVG. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {zones.map(zone => zone.points[0] && (
                <OverlayTag key={zone.id} at={zone.points[0]} swatch={zone.color}>{zone.name}</OverlayTag>
              ))}
              {lines.map(line => {
                const anchors = sideAnchors(line.start_point, line.end_point);
                return (
                  <span key={line.id}>
                    <OverlayTag at={line.start_point} swatch={line.color}>{line.name}</OverlayTag>
                    {anchors && <SideMarker at={anchors.a}>A</SideMarker>}
                    {anchors && <SideMarker at={anchors.b}>B</SideMarker>}
                  </span>
                );
              })}
              {draftAnchors && <SideMarker at={draftAnchors.a} draft>A</SideMarker>}
              {draftAnchors && <SideMarker at={draftAnchors.b} draft>B</SideMarker>}
              {draft.map((p, i) => (
                <span
                  key={i}
                  className="absolute grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center border border-signal-foreground bg-signal px-0.5 font-mono text-micro font-semibold leading-none text-signal-foreground"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  {mode === 'line' ? (i === 0 ? 'S' : 'E') : i + 1}
                </span>
              ))}
            </div>
          </div>
        </ViewportFrame>
      </div>

      <p role="status" aria-atomic="true" className="sr-only">{announcement}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="draft-heading" className="border border-border-strong bg-surface">
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border-strong px-4">
            <h3 id="draft-heading" className="font-display text-title font-semibold">
              Draft {mode} <span className="vg-telemetry text-muted-foreground">· {draft.length} {draft.length === 1 ? 'point' : 'points'}</span>
            </h3>
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={() => removePoint(draft.length - 1)} disabled={draft.length === 0} aria-label="Undo last point">
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={() => { setDraft([]); setAnnouncement('Draft cleared.'); }} disabled={draft.length === 0} aria-label="Clear draft">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {draft.length === 0 ? (
            <p className="px-4 py-4 text-body-sm text-muted-foreground">No points placed yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {draft.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 pl-4 pr-1">
                  <span className="vg-telemetry">
                    <span className="inline-block w-12 text-muted-foreground">{mode === 'line' ? (i === 0 ? 'START' : 'END') : `P${i + 1}`}</span>
                    {formatPoint(p)}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={() => removePoint(i)} aria-label={`Remove ${pointName(mode, i)}`}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ol>
          )}

          <form onSubmit={handleCoordinateAdd} noValidate className="border-t border-border p-4">
            <fieldset className="space-y-3">
              <legend className="vg-label mb-3 text-foreground">Add a point by coordinates</legend>
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="point-x">X (0–1)</Label>
                  <Input id="point-x" type="number" inputMode="decimal" min={0} max={1} step={0.01} value={xInput} onChange={e => setXInput(e.target.value)} aria-describedby="point-entry-error" className="h-11 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="point-y">Y (0–1)</Label>
                  <Input id="point-y" type="number" inputMode="decimal" min={0} max={1} step={0.01} value={yInput} onChange={e => setYInput(e.target.value)} aria-describedby="point-entry-error" className="h-11 font-mono" />
                </div>
                <Button type="submit" variant="outline" className="h-11" disabled={draft.length >= maxPoints}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              <p className="text-body-sm text-muted-foreground">0, 0 is the top-left of the source frame; 1, 1 the bottom-right.</p>
              <p id="point-entry-error" className="text-body-sm text-danger-ink empty:hidden">{entryError}</p>
            </fieldset>
          </form>
        </section>

        <section aria-labelledby="save-heading" className="border border-border-strong bg-surface">
          <div className="flex min-h-12 items-center border-b border-border-strong px-4">
            <h3 id="save-heading" className="font-display text-title font-semibold">Save {mode}</h3>
          </div>
          <form onSubmit={handleSave} method="post" aria-busy={saving} className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="geometry-name">Name</Label>
              <Input id="geometry-name" name="name" value={name} onChange={e => setName(e.target.value)} maxLength={255} required autoComplete="off" className="h-11" />
            </div>

            {mode === 'zone' ? (
              <div className="space-y-2">
                <Label htmlFor="zone-type">Zone type</Label>
                <Select value={zoneType} onValueChange={v => v && setZoneType(v)}>
                  <SelectTrigger id="zone-type" className="h-11 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ZONE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{humanize(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="line-direction">Counted direction</Label>
                <Select value={direction} onValueChange={v => v && setDirection(v)}>
                  <SelectTrigger id="line-direction" className="h-11" aria-describedby="line-direction-hint"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIRECTION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p id="line-direction-hint" className="text-body-sm text-muted-foreground">
                  Side A is on the right when facing from start to end. The overlay marks both sides.
                </p>
              </div>
            )}

            <p id="geometry-issue" className="vg-telemetry text-muted-foreground">
              {issue ?? `Ready: ${draft.length} points, normalised.`}
            </p>

            <ActionAlert message={saveError} />

            <Button type="submit" disabled={!canSave} aria-describedby="geometry-issue" className="min-h-11 w-full">
              {saving ? 'Saving…' : `Save ${mode}`}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

function pointName(mode: Mode, index: number) {
  if (mode === 'line') return index === 0 ? 'Start point' : 'End point';
  return `Point ${index + 1}`;
}

const svgPoints = (points: Point[]) => points.map(p => `${p.x},${p.y}`).join(' ');
const lineProps = (a: Point, b: Point) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

function OverlayTag({ at, swatch, children }: { at: Point; swatch: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'absolute inline-flex max-w-[45%] items-center gap-1 border border-border bg-background/85 px-1.5 py-0.5 font-mono text-micro uppercase leading-tight text-foreground',
        at.y < 0.08 ? 'translate-y-1' : '-translate-y-[calc(100%+4px)]',
        at.x > 0.6 && '-translate-x-full',
      )}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
    >
      <span className="h-2 w-2 shrink-0" style={{ backgroundColor: swatch }} />
      <span className="truncate">{children}</span>
    </span>
  );
}

function SideMarker({ at, draft = false, children }: { at: Point; draft?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center border font-mono text-micro font-semibold',
        draft ? 'border-signal-foreground bg-signal text-signal-foreground' : 'border-border bg-background/85 text-foreground',
      )}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
    >
      {children}
    </span>
  );
}

