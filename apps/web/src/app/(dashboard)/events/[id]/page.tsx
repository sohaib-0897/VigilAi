'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Eye, ShieldAlert, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { AnalyticsRule, Camera, Event, VirtualLine, Zone } from '@/lib/types';
import { statusTone } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/primitives/panel';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { ActionAlert, LoadErrorPanel } from '@/components/console/feedback';
import { duration, errorMessage, shortId, utcStamp } from '@/components/console/format';
import { ruleTypeLabel } from '@/components/console/vocabulary';
import { EvidenceFrame } from '@/components/events/evidence-frame';
import { TriggerDetails } from '@/components/events/trigger-details';

type StatusAction = { status: string; label: string; pending: string; icon: typeof Check; variant: 'default' | 'outline' };

const ACTIONS: StatusAction[] = [
  { status: 'acknowledged', label: 'Acknowledge', pending: 'Acknowledging…', icon: Eye, variant: 'outline' },
  { status: 'resolved', label: 'Resolve', pending: 'Resolving…', icon: Check, variant: 'default' },
  { status: 'dismissed', label: 'Dismiss', pending: 'Dismissing…', icon: X, variant: 'outline' },
];

/** Names for the ids on an event. Each lookup may fail on its own; the ids still show. */
interface Related { camera?: Camera; rule?: AnalyticsRule; zone?: Zone; line?: VirtualLine }

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [related, setRelated] = useState<Related>({});
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvent(await api.getEvent(id));
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorMessage(cause, 'The event could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cameraId = event?.camera_id;
  useEffect(() => {
    if (!cameraId) return;
    let cancelled = false;
    Promise.allSettled([api.getCamera(cameraId), api.getRules(cameraId), api.getZones(cameraId), api.getLines(cameraId)])
      .then(([camera, rules, zones, lines]) => {
        if (cancelled) return;
        setRelated({
          camera: camera.status === 'fulfilled' ? camera.value : undefined,
          rule: rules.status === 'fulfilled' ? rules.value.find(r => r.id === event?.rule_id) : undefined,
          zone: zones.status === 'fulfilled' ? zones.value.find(z => z.id === event?.zone_id) : undefined,
          line: lines.status === 'fulfilled' ? lines.value.find(l => l.id === event?.line_id) : undefined,
        });
      });
    return () => { cancelled = true; };
    // The ids on an event never change; reload only when the camera does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  const changeStatus = async (action: StatusAction) => {
    setPendingStatus(action.status);
    setActionError(null);
    try {
      setEvent(await api.updateEventStatus(id, action.status));
      setAnnouncement(`Event status changed to ${action.status}.`);
    } catch (cause) {
      setActionError(errorMessage(cause, 'The status could not be changed.'));
    } finally {
      setPendingStatus(null);
    }
  };

  const breadcrumb = (
    <nav aria-label="Breadcrumb">
      <ol className="vg-label flex flex-wrap items-center gap-x-2 text-muted-foreground">
        <li>
          <Link href="/events" className="inline-flex min-h-11 items-center underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-8">Events</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li><span aria-current="page" className="text-foreground">Event {shortId(id)}</span></li>
      </ol>
    </nav>
  );

  if (!event) {
    return (
      <div className="space-y-6">
        {breadcrumb}
        {loadError && !loading
          ? <LoadErrorPanel title="The event could not be loaded." detail={loadError} onRetry={load} />
          : <DetailSkeleton />}
      </div>
    );
  }

  const cameraName = related.camera?.name ?? `Camera ${shortId(event.camera_id)}`;
  const hasTrack = event.track_id !== null && event.track_id !== undefined;
  const subject = [event.object_class, hasTrack ? `track #${event.track_id}` : null].filter(Boolean).join(' ');
  const evidences = event.evidences ?? [];
  const missingPpe: string[] = Array.isArray(event.metadata?.missing_ppe) ? event.metadata.missing_ppe : [];
  const available = ACTIONS.filter(a => a.status !== event.status && !(a.status === 'acknowledged' && event.status !== 'active'));
  const geometryLabel = event.zone_id
    ? `zone “${related.zone?.name ?? shortId(event.zone_id)}”`
    : event.line_id ? `line “${related.line?.name ?? shortId(event.line_id)}”` : null;

  return (
    <div className="space-y-6">
      {breadcrumb}
      <SectionHeader
        tag={`Event ${shortId(event.id)}`}
        title={ruleTypeLabel(event.event_type)}
        description={`${subject ? `${subject[0].toUpperCase()}${subject.slice(1)} on` : 'On'} ${cameraName}${geometryLabel ? `, ${geometryLabel}` : ''}. Started ${utcStamp(event.started_at)}.`}
      />

      <p role="status" className="sr-only">{announcement}</p>

      {event.event_type === 'ppe_violation' && missingPpe.length > 0 && (
        <div className="flex items-start gap-3 border border-border-strong bg-danger px-4 py-3 text-danger-foreground">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-body">
            <span className="font-semibold">Missing equipment: {missingPpe.join(', ')}.</span>{' '}
            Confirmed by the PPE pipeline over its confirmation window; this is a model decision, not a certified safety check.
          </p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-8">
          <Panel
            labelId="evidence-heading"
            title="Evidence"
            meta={<span className="vg-telemetry text-muted-foreground">{evidences.length} {evidences.length === 1 ? 'snapshot' : 'snapshots'}</span>}
          >
            {evidences.length === 0 ? (
              <div className="space-y-2 px-4 py-10 text-center sm:px-6">
                <p className="text-body font-semibold">No evidence was stored for this event.</p>
                <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">
                  The worker saves an annotated snapshot when an event fires. None is linked to this event, so there is nothing to show.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 p-4 lg:grid-cols-2 [&>*:only-child]:lg:col-span-2">
                {evidences.map((evidence, index) => (
                  <EvidenceFrame
                    key={evidence.id}
                    eventId={event.id}
                    evidence={evidence}
                    index={index}
                    alt={`Annotated snapshot of the ${ruleTypeLabel(event.event_type).toLowerCase()} event${subject ? ` for ${subject}` : ''} on ${cameraName}${geometryLabel ? `, with the ${geometryLabel.split(' ')[0]} outlined` : ''}.`}
                  />
                ))}
              </div>
            )}
          </Panel>

          <TriggerDetails event={event} />
        </div>

        <div className="grid content-start gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Panel labelId="status-heading" title="Status" meta={<StatusIndicator tone={statusTone(event.status)} label={event.status} />}>
            <div className="space-y-4 p-4">
              <p className="text-body-sm text-muted-foreground">
                The worker marks an event resolved when its condition ends. Acknowledged and dismissed events keep that status.
              </p>
              {available.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {available.map(action => {
                    const Icon = action.icon;
                    return (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        onClick={() => changeStatus(action)}
                        disabled={pendingStatus !== null}
                        className="min-h-11 sm:min-h-10"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {pendingStatus === action.status ? action.pending : action.label}
                      </Button>
                    );
                  })}
                </div>
              )}
              <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />
            </div>
          </Panel>

          <Panel labelId="details-heading" title="Details">
            <dl className="divide-y divide-border text-body-sm">
              <Row term="Severity"><SeverityBadge severity={event.severity} /></Row>
              <Row term="Started"><time dateTime={event.started_at} className="vg-telemetry">{utcStamp(event.started_at)}</time></Row>
              <Row term="Ended">
                {event.ended_at ? (
                  <span className="vg-telemetry">
                    <time dateTime={event.ended_at}>{utcStamp(event.ended_at)}</time>
                    <span className="block text-muted-foreground">
                      after {duration((Date.parse(event.ended_at) - Date.parse(event.started_at)) / 1000)}
                    </span>
                  </span>
                ) : <span className="text-muted-foreground">Not ended</span>}
              </Row>
              <Row term="Camera">
                <Link href={`/cameras/${event.camera_id}`} className="inline-flex min-h-11 items-center gap-1 break-all underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-0">
                  {cameraName}
                </Link>
              </Row>
              <Row term="Rule">
                {event.rule_id ? (
                  <Link href={`/rules?camera=${event.camera_id}`} className="inline-flex min-h-11 items-center gap-1 underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-0">
                    {related.rule?.name ?? `Rule ${shortId(event.rule_id)}`}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : <span className="text-muted-foreground">Rule deleted</span>}
              </Row>
              {event.zone_id && <Row term="Zone">{related.zone?.name ?? <span className="vg-telemetry">{shortId(event.zone_id)}</span>}</Row>}
              {event.line_id && <Row term="Line">{related.line?.name ?? <span className="vg-telemetry">{shortId(event.line_id)}</span>}</Row>}
              <Row term="Object class">{event.object_class ?? <span className="text-muted-foreground">None (zone-level event)</span>}</Row>
              <Row term="Track">{hasTrack ? <span className="vg-telemetry">#{event.track_id}</span> : <span className="text-muted-foreground">None (zone-level event)</span>}</Row>
              <Row term="Fingerprint"><span className="vg-telemetry break-all">{event.fingerprint}</span></Row>
              <Row term="Event ID"><span className="vg-telemetry break-all">{event.id}</span></Row>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 px-4 py-2.5">
      <dt className="vg-label text-muted-foreground">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading event" className="space-y-6">
      <div className="space-y-3 border-b border-border-strong pb-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="aspect-video border border-border xl:col-span-8" />
        <Skeleton className="h-72 border border-border xl:col-span-4" />
      </div>
    </div>
  );
}
