'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { SystemHealth, SystemMetrics } from '@/lib/types';
import type { Tone } from '@/lib/status';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricDisplay } from '@/components/primitives/metric-display';
import { Panel } from '@/components/primitives/panel';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { clock, errorMessage } from '@/components/console/format';

// Workers publish a heartbeat every 5 s with a 10 s TTL (worker/heartbeat.py).
const POLL_MS = 10_000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

interface Service { name: string; role: string; tone: Tone; state: string; detail: string }

const dependency = (value: string | undefined, healthOk: boolean): Pick<Service, 'tone' | 'state'> => {
  if (!healthOk) return { tone: 'neutral', state: 'Unknown' };
  if (value === 'ok') return { tone: 'success', state: 'OK' };
  return { tone: 'danger', state: value ? value : 'Not reported' };
};

function services(health: Result<SystemHealth> | null, metrics: Result<SystemMetrics> | null): Service[] {
  const h = health?.ok ? health.value : null;
  const workers = metrics?.ok ? metrics.value.workers : null;
  return [
    {
      name: 'API',
      role: 'FastAPI · serves this console',
      ...(h
        ? { tone: h.status === 'healthy' ? 'success' : 'warning', state: h.status === 'healthy' ? 'Healthy' : 'Degraded' } as const
        : { tone: 'danger', state: 'Not responding' } as const),
      detail: h ? `Reports version ${h.version}` : health && !health.ok ? health.error : 'Waiting for response',
    },
    {
      name: 'Database',
      role: 'PostgreSQL · checked with SELECT 1',
      ...dependency(h?.details.database, Boolean(h)),
      detail: h ? 'Checked by the API on this request' : 'The API health check did not answer',
    },
    {
      name: 'Redis',
      role: 'Commands, heartbeats and event fan-out',
      ...dependency(h?.details.redis, Boolean(h)),
      detail: h ? 'Pinged by the API on this request' : 'The API health check did not answer',
    },
    {
      name: 'Inference workers',
      role: 'Heartbeat keys in Redis',
      ...(workers === null
        ? { tone: 'neutral', state: 'Unknown' } as const
        : workers > 0
          ? { tone: 'success', state: `${workers} reporting` } as const
          : { tone: 'warning', state: 'None reporting' } as const),
      detail: workers === null
        ? (metrics && !metrics.ok ? metrics.error : 'Waiting for response')
        : workers > 0 ? 'A heartbeat arrived within the last 10 s' : 'No worker heartbeat in the last 10 s; analytics cannot run',
    },
  ];
}

const settle = <T,>(promise: Promise<T>): Promise<Result<T>> =>
  promise.then(value => ({ ok: true as const, value }), cause => ({ ok: false as const, error: errorMessage(cause, 'Request failed') }));

export default function SystemPage() {
  const [health, setHealth] = useState<Result<SystemHealth> | null>(null);
  const [metrics, setMetrics] = useState<Result<SystemMetrics> | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    // Each endpoint can fail on its own; one failure must not hide the other's answer.
    const [h, m] = await Promise.all([settle(api.getHealth()), settle(api.getMetrics())]);
    setHealth(h);
    setMetrics(m);
    setUpdatedAt(new Date());
    setLoading(false);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const header = (
    <SectionHeader
      tag="System"
      title="System"
      description="What the API reports about itself, its dependencies and the inference workers. Values come from /system/health and /system/metrics; nothing on this page is estimated."
      action={
        <>
          <span className="vg-telemetry text-muted-foreground">
            {updatedAt ? `Updated ${clock(updatedAt)} · refresh ${POLL_MS / 1000}s` : 'Loading…'}
          </span>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="min-h-11 sm:min-h-8">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
            {loading && updatedAt ? 'Refreshing…' : 'Refresh'}
          </Button>
        </>
      }
    />
  );

  if (!updatedAt) {
    return (
      <div className="space-y-6">
        {header}
        <SystemSkeleton />
      </div>
    );
  }

  const m = metrics?.ok ? metrics.value : null;
  const multiple = (m?.workers ?? 0) > 1;

  return (
    <div className="space-y-6">
      {header}

      <Panel labelId="services-heading" title="Services">
        <ul className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-4">
          {services(health, metrics).map(s => (
            <li key={s.name} className="space-y-3 bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-body font-semibold">{s.name}</h3>
                <StatusIndicator tone={s.tone} label={s.state} />
              </div>
              <p className="vg-label text-muted-foreground">{s.role}</p>
              <p className="text-body-sm text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          labelId="worker-heading"
          title="Worker telemetry"
          meta={<span className="vg-telemetry text-muted-foreground">From worker heartbeats</span>}
        >
          {metrics && !metrics.ok ? (
            <p role="alert" className="flex items-start gap-2 p-4 text-body-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
              Worker metrics could not be loaded ({metrics.error}).
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-px bg-border min-[480px]:grid-cols-2 lg:grid-cols-3">
                <Cell><MetricDisplay size="sm" label="Active streams" value={m?.active_streams} context="Camera pipelines running, all workers" /></Cell>
                <Cell><MetricDisplay size="sm" label="Processing rate" value={m?.pipeline_fps} unit="FPS" context="Mean of per-camera rates" /></Cell>
                <Cell><MetricDisplay size="sm" label="Frames processed" value={m?.frames_processed?.toLocaleString('en-US')} context="Sum since each pipeline started" /></Cell>
                <Cell><MetricDisplay size="sm" label="Frames dropped" value={m?.frames_dropped?.toLocaleString('en-US')} context="Oldest frames discarded when the bounded buffer is full" /></Cell>
                <Cell><MetricDisplay size="sm" label="Host CPU" value={m?.cpu_usage_percent} unit="%" context={multiple ? 'First worker’s host only' : 'Worker host, all processes'} /></Cell>
                <Cell><MetricDisplay size="sm" label="Host memory" value={m?.memory_usage_percent} unit="%" context={multiple ? 'First worker’s host only' : 'Worker host, all processes'} /></Cell>
              </ul>
              <p className="border-t border-border px-4 py-2 text-body-sm text-muted-foreground">
                {m && m.workers > 0
                  ? 'NOT_MEASURED means no running pipeline reported that value.'
                  : 'No worker is reporting, so none of these values are measured. Start the worker process to see them.'}
              </p>
            </>
          )}
        </Panel>

        <Panel className="xl:col-span-4" labelId="raw-heading" title="Raw responses">
          <div className="space-y-2 p-4">
            <p className="text-body-sm text-muted-foreground">The JSON returned by the two endpoints on the last refresh.</p>
            <RawBlock label="GET /system/health" result={health} />
            <RawBlock label="GET /system/metrics" result={metrics} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <li className="bg-surface p-4">{children}</li>;
}

function RawBlock({ label, result }: { label: string; result: Result<unknown> | null }) {
  return (
    <details className="border border-border">
      <summary className="vg-label flex min-h-11 cursor-pointer items-center px-3 text-foreground hover:bg-muted">{label}</summary>
      <pre className="vg-telemetry max-h-64 overflow-auto border-t border-border bg-muted/50 p-3 text-foreground">
        {result === null ? 'No response yet' : result.ok ? JSON.stringify(result.value, null, 2) : `Error: ${result.error}`}
      </pre>
    </details>
  );
}

function SystemSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading system status" className="space-y-6">
      <div className="grid gap-px border border-border-strong bg-border md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 bg-surface p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 border border-border" />
    </div>
  );
}
