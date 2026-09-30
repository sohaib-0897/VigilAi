'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useEventStream } from '@/lib/hooks';
import { OverviewStats, Event } from '@/lib/types';
import { cn } from '@/lib/utils';
import { severityTone, statusTone, toneDot } from '@/lib/status';
import { SectionHeader } from '@/components/ui/section-header';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricDisplay } from '@/components/primitives/metric-display';
import { Panel } from '@/components/primitives/panel';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { TechnicalLabel } from '@/components/primitives/technical-label';

// Fallback refresh for values the event stream does not carry (camera status,
// track summaries). New events trigger an immediate refresh instead.
const POLL_MS = 30_000;
const EVENT_REFRESH_DEBOUNCE_MS = 1_000;
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

const utc = (iso: string) => new Date(iso).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
const clock = (date: Date) => date.toISOString().substring(11, 19) + ' UTC';
const humanize = (value: string) => value.replace(/_/g, ' ');

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const { lastMessage, connected } = useEventStream();

  const fetchStats = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const data = await api.getOverview();
      setStats(data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      if (!document.hidden) fetchStats();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // A persisted event changes the counters and the recent list: refresh once per burst.
  useEffect(() => {
    if (!lastMessage) return;
    const timeout = setTimeout(fetchStats, EVENT_REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [lastMessage, fetchStats]);

  const header = (
    <SectionHeader
      tag="Overview"
      title="Surveillance Overview"
      description="Camera availability, today's event volume and the latest events across the cameras you own."
      action={
        <>
          <StatusIndicator
            variant="inline"
            tone={connected ? 'success' : 'inactive'}
            live={connected}
            label={connected ? 'Event stream live' : `Event stream offline · refresh ${POLL_MS / 1000}s`}
          />
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="min-h-11 sm:min-h-8">
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
            {loading ? (stats ? 'Refreshing…' : 'Loading…') : 'Refresh'}
          </Button>
        </>
      }
    />
  );

  if (!stats && loading) {
    return (
      <div className="space-y-6">
        {header}
        <OverviewSkeleton />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        {header}
        <div role="alert" className="flex flex-col gap-4 border border-border-strong bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center bg-danger text-danger-foreground">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-body font-semibold">The overview could not be loaded.</p>
              <p className="vg-telemetry mt-1 text-muted-foreground">{error}</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchStats} className="min-h-11">Try again</Button>
        </div>
      </div>
    );
  }

  // Known severities first, then any other value the API reports, so the total is never hidden.
  const severityKeys = [
    ...SEVERITY_ORDER,
    ...Object.keys(stats.events_by_severity).filter(key => !SEVERITY_ORDER.includes(key)),
  ];
  const severityTotal = severityKeys.reduce((sum, key) => sum + (stats.events_by_severity[key] ?? 0), 0);

  return (
    <div className="space-y-6">
      {header}

      {error && updatedAt && (
        <p role="alert" className="vg-telemetry flex items-center gap-2 border border-warning bg-warning/15 px-3 py-2 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Refresh failed ({error}). Showing data from {clock(updatedAt)}.
        </p>
      )}

      <section aria-label="Key figures">
        <ul className="grid grid-cols-1 gap-px border border-border-strong bg-border min-[480px]:grid-cols-2 xl:grid-cols-4">
          <MetricCell>
            <MetricDisplay
              label="Cameras online"
              value={stats.active_cameras}
              unit={`/ ${stats.total_cameras}`}
              context={stats.total_cameras === 0 ? 'No cameras configured' : 'Status reported as online'}
            />
          </MetricCell>
          <MetricCell>
            <MetricDisplay label="Events today" value={stats.events_today} context="Since 00:00 UTC" />
          </MetricCell>
          <MetricCell alert={stats.high_severity_events > 0}>
            <MetricDisplay label="High + critical" value={stats.high_severity_events} context="All time" />
          </MetricCell>
          <MetricCell>
            <MetricDisplay
              label="Person tracks today"
              value={stats.people_count}
              context={`${stats.vehicle_count} vehicle tracks · since 00:00 UTC`}
            />
          </MetricCell>
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          labelId="recent-events-heading"
          title="Recent events"
          meta={
            <Link
              href="/events"
              className="vg-label inline-flex min-h-11 items-center gap-1.5 text-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              All events <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
        >
          {stats.recent_events.length === 0 ? (
            <div className="space-y-3 px-4 py-10 text-center sm:px-6">
              <p className="text-body font-semibold">No events recorded yet.</p>
              <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">
                Events appear here when a rule fires on a camera with analytics running.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="min-h-11"><Link href="/cameras">Cameras</Link></Button>
                <Button asChild variant="outline" size="sm" className="min-h-11"><Link href="/rules">Rules</Link></Button>
              </div>
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {stats.recent_events.map(ev => <EventRow key={ev.id} event={ev} />)}
            </ol>
          )}
          <p className="vg-telemetry border-t border-border px-4 py-2 text-muted-foreground">
            Latest {stats.recent_events.length} · {updatedAt ? `updated ${clock(updatedAt)}` : ''}
          </p>
        </Panel>

        <div className="grid content-start gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Panel labelId="severity-heading" title="Events by severity" meta={<span className="vg-telemetry text-muted-foreground">All time</span>}>
            {severityTotal === 0 ? (
              <p className="px-4 py-8 text-center text-body-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <dl className="divide-y divide-border">
                {severityKeys.map(key => {
                  const count = stats.events_by_severity[key] ?? 0;
                  return (
                    <div key={key} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 px-4 py-3">
                      <dt className="vg-label inline-flex items-center gap-2 text-foreground">
                        <span className={cn('h-2 w-2 shrink-0', toneDot[severityTone(key)])} aria-hidden="true" />
                        {key}
                      </dt>
                      <div className="h-1.5 bg-muted" aria-hidden="true">
                        <div className={cn('h-full', toneDot[severityTone(key)])} style={{ width: `${(count / severityTotal) * 100}%` }} />
                      </div>
                      <dd className="vg-telemetry min-w-[3ch] text-right text-foreground">{count}</dd>
                    </div>
                  );
                })}
              </dl>
            )}
          </Panel>

          <Panel labelId="diagnostics-heading" title="Diagnostics">
            <div className="space-y-3 p-4">
              <p className="text-body-sm text-muted-foreground">
                Worker health, stream throughput and the loaded models are reported on the System page.
              </p>
              <Button asChild variant="outline" className="min-h-11 w-full">
                <Link href="/system">Open system diagnostics</Link>
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MetricCell({ alert = false, children }: { alert?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('relative bg-surface p-4 sm:p-5', alert && 'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-danger')}>
      {children}
    </li>
  );
}

function EventRow({ event }: { event: Event }) {
  const hasTrack = event.track_id !== null && event.track_id !== undefined;
  return (
    <li>
      <Link
        href={`/events/${event.id}`}
        className="group flex min-h-11 flex-col gap-2 px-4 py-3 transition-colors duration-micro ease-standard hover:bg-muted focus-visible:outline-offset-[-2px] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="min-w-0">
          <p className="truncate text-body font-semibold capitalize">{humanize(event.event_type)}</p>
          <p className="vg-telemetry mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
            <time dateTime={event.started_at}>{utc(event.started_at)}</time>
            <span>CAM {event.camera_id.substring(0, 8)}</span>
            {event.object_class && <span>{event.object_class}</span>}
            {hasTrack && <span>TRACK #{event.track_id}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SeverityBadge severity={event.severity} />
          <StatusIndicator variant="inline" tone={statusTone(event.status)} label={event.status} />
          <ArrowRight
            className="h-4 w-4 text-muted-foreground transition-transform duration-micro ease-standard group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </Link>
    </li>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading overview" className="space-y-6">
      <div className="grid grid-cols-1 gap-px border border-border-strong bg-border min-[480px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 bg-surface p-4 sm:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-px border border-border-strong bg-surface xl:col-span-8">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2 p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-56 border border-border xl:col-span-4" />
      </div>
    </div>
  );
}
