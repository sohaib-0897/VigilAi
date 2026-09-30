'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { Camera } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricDisplay } from '@/components/primitives/metric-display';
import { Panel } from '@/components/primitives/panel';
import { LoadErrorPanel } from '@/components/console/feedback';
import { clock, errorMessage } from '@/components/console/format';
import { ruleTypeLabel } from '@/components/console/vocabulary';
import { EventsChart } from '@/components/analytics/events-chart';
import { bucketLabel, fillBuckets, type Bucket, type BucketUnit } from '@/components/analytics/buckets';

const WINDOWS = {
  '24h': { label: 'Last 24 hours', hours: 24, unit: 'hour' },
  '7d': { label: 'Last 7 days', hours: 24 * 7, unit: 'day' },
  '30d': { label: 'Last 30 days', hours: 24 * 30, unit: 'day' },
} as const satisfies Record<string, { label: string; hours: number; unit: BucketUnit }>;

type WindowKey = keyof typeof WINDOWS;
const ALL = 'all';

interface Result {
  buckets: Bucket[];
  distribution: [string, number][];
  unit: BucketUnit;
  start: Date;
  end: Date;
  loadedAt: Date;
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<WindowKey>('7d');
  const [camera, setCamera] = useState(ALL);
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    api.getCameras(1, 100).then(res => setCameras(res.items)).catch(() => setCameras([]));
  }, []);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    const win = WINDOWS[range];
    const end = new Date();
    const start = new Date(end.getTime() - win.hours * 3_600_000);
    const params: Record<string, string> = { start: start.toISOString(), end: end.toISOString() };
    if (camera !== ALL) params.camera_id = camera;
    setLoading(true);
    try {
      const [series, distribution] = await Promise.all([
        api.getTimeseries({ ...params, interval: win.unit }),
        api.getDistribution(params),
      ]);
      if (id !== requestId.current) return;
      setResult({
        buckets: fillBuckets(series, start, end, win.unit),
        distribution: Object.entries(distribution).sort((a, b) => b[1] - a[1]),
        unit: win.unit,
        start,
        end,
        loadedAt: new Date(),
      });
      setError(null);
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(errorMessage(cause, 'Analytics could not be loaded.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [range, camera]);

  useEffect(() => { load(); }, [load]);

  const cameraName = camera === ALL ? 'all cameras' : cameras?.find(c => c.id === camera)?.name ?? 'the selected camera';

  const header = (
    <SectionHeader
      tag="Analytics"
      title="Analytics"
      description="Event volume over time and by type, counted from the events stored in the database. Buckets are UTC hours or days."
      action={
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="min-h-11 sm:min-h-8">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
          {loading && result ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    />
  );

  const controls = (
    <div className="grid gap-4 border border-border-strong bg-surface p-4 sm:grid-cols-2 lg:max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="analytics-window">Window</Label>
        <Select value={range} onValueChange={v => v && setRange(v as WindowKey)}>
          <SelectTrigger id="analytics-window" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(WINDOWS) as WindowKey[]).map(k => <SelectItem key={k} value={k}>{WINDOWS[k].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="analytics-camera">Camera</Label>
        <Select value={camera} onValueChange={v => v && setCamera(v)}>
          <SelectTrigger id="analytics-camera" className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All cameras</SelectItem>
            {cameras?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (!result) {
    return (
      <div className="space-y-6">
        {header}
        {controls}
        {error && !loading
          ? <LoadErrorPanel title="Analytics could not be loaded." detail={error} onRetry={load} />
          : <AnalyticsSkeleton />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {controls}
      {error && (
        <p role="alert" className="vg-telemetry flex items-center gap-2 border border-warning bg-warning/15 px-3 py-2 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Refresh failed ({error}). Showing data loaded at {clock(result.loadedAt)}.
        </p>
      )}
      <div aria-busy={loading} className={cn('space-y-6 transition-opacity duration-micro', loading && 'opacity-60')}>
        <Report result={result} cameraName={cameraName} />
      </div>
    </div>
  );
}

function Report({ result, cameraName }: { result: Result; cameraName: string }) {
  const { buckets, distribution, unit } = result;
  const total = distribution.reduce((sum, [, n]) => sum + n, 0);
  const peak = useMemo(() => buckets.reduce<Bucket | null>((best, b) => (b.count > (best?.count ?? 0) ? b : best), null), [buckets]);
  const active = buckets.filter(b => b.count > 0).length;
  const range = `${bucketLabel(result.start.getTime(), 'hour')} – ${bucketLabel(result.end.getTime(), 'hour')}`;
  const unitWord = unit === 'hour' ? 'hour' : 'day';

  return (
    <>
      <section aria-label="Totals">
        <ul className="grid grid-cols-1 gap-px border border-border-strong bg-border min-[480px]:grid-cols-3">
          <li className="bg-surface p-4 sm:p-5">
            <MetricDisplay label="Events in window" value={total} context={`${cameraName} · ${range}`} />
          </li>
          <li className="bg-surface p-4 sm:p-5">
            <MetricDisplay
              label={`Busiest ${unitWord}`}
              value={peak ? peak.count : 0}
              unit="events"
              context={peak ? bucketLabel(peak.start, unit) : `No events in any ${unitWord}`}
            />
          </li>
          <li className="bg-surface p-4 sm:p-5">
            <MetricDisplay label={`${unitWord === 'hour' ? 'Hours' : 'Days'} with events`} value={active} unit={`/ ${buckets.length}`} context={`UTC ${unitWord}s in the window`} />
          </li>
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          labelId="volume-heading"
          title="Events over time"
          meta={<span className="vg-telemetry text-muted-foreground">Per UTC {unitWord}</span>}
        >
          {total === 0 ? (
            <EmptyWindow />
          ) : (
            <div className="space-y-4 p-4">
              <p className="text-body-sm text-muted-foreground">
                {total} {total === 1 ? 'event' : 'events'} across {buckets.length} {unitWord}s; the busiest {unitWord} ({peak && bucketLabel(peak.start, unit)}) had {peak?.count}.
                The first and last {unitWord}s are partial because the window is rolling.
              </p>
              <EventsChart buckets={buckets} unit={unit} />
              <details className="border-t border-border pt-2">
                <summary className="vg-label flex min-h-11 cursor-pointer items-center text-foreground">Show data table</summary>
                <div className="max-h-80 overflow-auto border border-border">
                  <table className="w-full text-table">
                    <caption className="sr-only">Events per UTC {unitWord}</caption>
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th scope="col" className="vg-label px-3 py-2 text-left font-medium text-muted-foreground">{unit === 'hour' ? 'Hour (UTC)' : 'Day (UTC)'}</th>
                        <th scope="col" className="vg-label px-3 py-2 text-right font-medium text-muted-foreground">Events</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {buckets.map(b => (
                        <tr key={b.start}>
                          <td className="vg-telemetry px-3 py-1.5">{bucketLabel(b.start, unit)}</td>
                          <td className="vg-telemetry px-3 py-1.5 text-right">{b.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
        </Panel>

        <Panel
          className="xl:col-span-4"
          labelId="types-heading"
          title="By event type"
          meta={<span className="vg-telemetry text-muted-foreground">{total} total</span>}
        >
          {distribution.length === 0 ? (
            <EmptyWindow />
          ) : (
            <dl className="divide-y divide-border">
              {distribution.map(([type, count]) => {
                const share = total > 0 ? count / total : 0;
                return (
                  <div key={type} className="space-y-2 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-body-sm font-semibold">{ruleTypeLabel(type)}</dt>
                      <dd className="vg-telemetry shrink-0 text-foreground">
                        {count} <span className="text-muted-foreground">· {Math.round(share * 100)}%</span>
                      </dd>
                    </div>
                    <div className="h-1.5 bg-muted" aria-hidden="true">
                      <div className="h-full bg-foreground" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </dl>
          )}
        </Panel>
      </div>
    </>
  );
}

function EmptyWindow() {
  return (
    <div className="space-y-2 px-4 py-10 text-center sm:px-6">
      <p className="text-body font-semibold">No events in this window.</p>
      <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">
        Try a longer window or another camera. Events are recorded only when a rule fires; see <Link href="/rules" className="underline decoration-1 underline-offset-4 hover:decoration-2">Rules</Link>.
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading analytics" className="space-y-6">
      <div className="grid grid-cols-1 gap-px border border-border-strong bg-border min-[480px]:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-3 bg-surface p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-80 border border-border xl:col-span-8" />
        <Skeleton className="h-80 border border-border xl:col-span-4" />
      </div>
    </div>
  );
}
