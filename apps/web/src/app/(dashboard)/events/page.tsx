'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useEventStream } from '@/lib/hooks';
import type { Camera, Event, PaginatedResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { ActionAlert, LoadErrorPanel } from '@/components/console/feedback';
import { clock, errorMessage } from '@/components/console/format';
import { EventTable } from '@/components/events/event-table';
import { ALL, EMPTY_FILTERS, EventFilters, filterParams, hasFilters, type EventFilterValues } from '@/components/events/event-filters';

const PAGE_SIZE = 20;
// `GET /events/export` returns at most this many rows (api/v1/events.py).
const EXPORT_LIMIT = 1000;

export default function EventsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<div className="space-y-6"><EventsHeader /><EventsSkeleton /></div>}>
      <EventsView />
    </Suspense>
  );
}

function EventsHeader({ action }: { action?: React.ReactNode }) {
  return (
    <SectionHeader
      tag="Events"
      title="Events"
      description="Events the worker recorded when a rule fired, newest first by start time. Open an event to review its evidence snapshot and change its status."
      action={action}
    />
  );
}

function readFilters(params: URLSearchParams): { filters: EventFilterValues; page: number } {
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    filters: {
      camera: params.get('camera') || ALL,
      type: params.get('type') || ALL,
      severity: params.get('severity') || ALL,
      status: params.get('status') || ALL,
    },
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function EventsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const { filters, page } = useMemo(() => readFilters(new URLSearchParams(queryString)), [queryString]);

  const [data, setData] = useState<PaginatedResponse<Event> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [camerasError, setCamerasError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [newEvents, setNewEvents] = useState(0);
  const requestId = useRef(0);
  const { lastMessage, connected } = useEventStream();

  // Filters and page live in the URL so returning from an event restores the view.
  const navigate = useCallback((next: EventFilterValues, nextPage: number) => {
    const params = new URLSearchParams();
    if (next.camera !== ALL) params.set('camera', next.camera);
    if (next.type !== ALL) params.set('type', next.type);
    if (next.severity !== ALL) params.set('severity', next.severity);
    if (next.status !== ALL) params.set('status', next.status);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  const load = useCallback(async () => {
    // Only the latest request may write state, so fast filter changes cannot race.
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await api.getEvents({ ...filterParams(filters), page: String(page), page_size: String(PAGE_SIZE) });
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
      setUpdatedAt(new Date());
      setNewEvents(0);
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(errorMessage(cause, 'The event list could not be loaded.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.getCameras(1, 100)
      .then(res => { setCameras(res.items); setCamerasError(null); })
      .catch(cause => { setCameras([]); setCamerasError(errorMessage(cause, 'Camera names could not be loaded.')); });
  }, []);

  // A page past the end (e.g. after events were filtered away) snaps to the last page.
  useEffect(() => {
    if (data && data.pages > 0 && page > data.pages) navigate(filters, data.pages);
  }, [data, page, filters, navigate]);

  // New events are announced, not spliced in: rows never move under the operator.
  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return;
    const m = lastMessage as Record<string, unknown>;
    const matches =
      (filters.camera === ALL || m.camera_id === filters.camera) &&
      (filters.type === ALL || m.event_type === filters.type) &&
      (filters.severity === ALL || m.severity === filters.severity) &&
      (filters.status === ALL || filters.status === 'active');
    if (matches) setNewEvents(n => n + 1);
    // Only react to new messages, not to filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const cameraNames = useMemo(
    () => Object.fromEntries((cameras ?? []).map(c => [c.id, c.name])),
    [cameras],
  );

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    setExportError(null);
    try {
      const blob = await api.exportEvents({ format, ...filterParams(filters) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vigilai_events_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after the click has been handled, or some browsers cancel the download.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setExportError(errorMessage(cause, 'The export failed.'));
    } finally {
      setExporting(null);
    }
  };

  const showLatest = () => (page === 1 ? load() : navigate(filters, 1));

  const header = (
    <EventsHeader
      action={
        <>
          <StatusIndicator
            variant="inline"
            tone={connected ? 'success' : 'inactive'}
            live={connected}
            label={connected ? 'Event stream live' : 'Event stream offline'}
          />
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="min-h-11 sm:min-h-8">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
            {loading && data ? 'Refreshing…' : 'Refresh'}
          </Button>
        </>
      }
    />
  );

  const filtersBar = <EventFilters values={filters} cameras={cameras} onChange={next => navigate(next, 1)} />;

  if (!data) {
    return (
      <div className="space-y-6">
        {header}
        {filtersBar}
        {error && !loading
          ? <LoadErrorPanel title="The event list could not be loaded." detail={error} onRetry={load} />
          : <EventsSkeleton />}
      </div>
    );
  }

  const first = data.total === 0 ? 0 : (data.page - 1) * data.page_size + 1;
  const last = Math.min(data.page * data.page_size, data.total);
  const summary = data.total === 0
    ? (hasFilters(filters) ? 'No events match these filters.' : 'No events recorded yet.')
    : `Showing ${first}–${last} of ${data.total} events.`;

  return (
    <div className="space-y-6">
      {header}
      {filtersBar}

      <p role="status" aria-live="polite" className="sr-only">{loading ? '' : summary}</p>

      {error && updatedAt && (
        <p role="alert" className="vg-telemetry flex items-center gap-2 border border-warning bg-warning/15 px-3 py-2 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Refresh failed ({error}). Showing data from {clock(updatedAt)}.
        </p>
      )}

      {newEvents > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border-strong bg-signal/20 px-4 py-2">
          <p className="text-body-sm">
            <span className="font-semibold">{newEvents} new {newEvents === 1 ? 'event' : 'events'}</span> matching these filters since {updatedAt ? clock(updatedAt) : 'the last load'}.
          </p>
          <Button variant="outline" size="sm" onClick={showLatest} className="min-h-11 sm:min-h-8">Show latest</Button>
        </div>
      )}

      {data.total === 0 ? (
        <div className="space-y-3 border border-border-strong bg-surface px-4 py-10 text-center sm:px-6">
          <p className="text-body font-semibold">{summary}</p>
          {hasFilters(filters) ? (
            <>
              <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">Clear one or more filters to widen the search.</p>
              <Button variant="outline" onClick={() => navigate(EMPTY_FILTERS, 1)} className="min-h-11">Clear filters</Button>
            </>
          ) : (
            <>
              <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">
                Events appear when a rule fires on a camera with analytics running.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="min-h-11"><Link href="/cameras">Cameras</Link></Button>
                <Button asChild variant="outline" size="sm" className="min-h-11"><Link href="/rules">Rules</Link></Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div aria-busy={loading} className={cn('transition-opacity duration-micro', loading && 'opacity-60')}>
          <EventTable events={data.items} cameraNames={cameraNames} />
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-border-strong pt-4 lg:flex-row lg:items-start lg:justify-between">
        {data.total > 0 ? (
          <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(filters, page - 1)}
              disabled={page <= 1 || loading}
              className="min-h-11 sm:min-h-10"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(filters, page + 1)}
              disabled={page >= data.pages || loading}
              className="min-h-11 sm:min-h-10"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="vg-telemetry text-muted-foreground">
              {first}–{last} of {data.total} · page {data.page} of {data.pages}
              {updatedAt && ` · loaded ${clock(updatedAt)}`}
            </p>
          </nav>
        ) : <span />}

        <div className="space-y-2 lg:max-w-sm lg:text-right">
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting !== null || data.total === 0} className="min-h-11 sm:min-h-10">
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting === 'csv' ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting !== null || data.total === 0} className="min-h-11 sm:min-h-10">
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting === 'json' ? 'Exporting…' : 'Export JSON'}
            </Button>
          </div>
          <p className="text-body-sm text-muted-foreground">
            Exports up to the newest {EXPORT_LIMIT.toLocaleString('en-US')} events that match the filters
            {data.total > EXPORT_LIMIT ? ` (${data.total.toLocaleString('en-US')} match, so older ones are left out).` : '.'}
          </p>
          <ActionAlert message={exportError} onDismiss={() => setExportError(null)} />
        </div>
      </div>

      {camerasError && (
        <p className="vg-telemetry text-muted-foreground">Camera names unavailable ({camerasError}); cameras are shown by ID.</p>
      )}
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading events" className="divide-y divide-border border border-border-strong bg-surface">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:gap-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-16 md:ml-auto" />
        </div>
      ))}
    </div>
  );
}
