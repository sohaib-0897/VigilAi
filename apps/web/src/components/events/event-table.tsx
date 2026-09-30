import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Event } from '@/lib/types';
import { statusTone } from '@/lib/status';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { shortId, utcStamp } from '@/components/console/format';
import { ruleTypeLabel } from '@/components/console/vocabulary';

type CameraNames = Record<string, string>;

const cameraName = (names: CameraNames, id: string) => names[id] ?? `CAM ${shortId(id)}`;
const hasTrack = (event: Event) => event.track_id !== null && event.track_id !== undefined;
const missingPpe = (event: Event): string[] =>
  Array.isArray(event.metadata?.missing_ppe) ? event.metadata.missing_ppe : [];

/**
 * Event history. A table from `md` up; below that, a list of whole-row links so
 * nothing scrolls sideways on a phone. Only one of the two is displayed.
 */
export function EventTable({ events, cameraNames }: { events: Event[]; cameraNames: CameraNames }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <caption className="sr-only">Events, newest first by start time. Times are UTC.</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="w-[13.5rem]">Started (UTC)</TableHead>
              <TableHead scope="col">Event</TableHead>
              <TableHead scope="col">Camera</TableHead>
              <TableHead scope="col" className="w-[7rem]">Severity</TableHead>
              <TableHead scope="col" className="w-[9rem]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map(event => (
              <TableRow key={event.id}>
                <TableCell className="vg-telemetry whitespace-nowrap text-muted-foreground">
                  <time dateTime={event.started_at}>{utcStamp(event.started_at).replace(' UTC', '')}</time>
                </TableCell>
                <TableCell className="min-w-[14rem]">
                  <Link
                    href={`/events/${event.id}`}
                    className="group inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-border decoration-1 underline-offset-4 hover:decoration-foreground hover:decoration-2"
                  >
                    {ruleTypeLabel(event.event_type)}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-micro ease-standard group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                  <EventFacts event={event} />
                </TableCell>
                <TableCell className="max-w-[14rem] truncate">{cameraName(cameraNames, event.camera_id)}</TableCell>
                <TableCell><SeverityBadge severity={event.severity} /></TableCell>
                <TableCell><StatusIndicator variant="inline" tone={statusTone(event.status)} label={event.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ol className="divide-y divide-border border border-border-strong bg-surface md:hidden">
        {events.map(event => (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className="group flex min-h-11 items-start justify-between gap-3 px-4 py-3 transition-colors duration-micro ease-standard hover:bg-muted focus-visible:outline-offset-[-2px]"
            >
              <div className="min-w-0 space-y-1.5">
                <p className="font-semibold">{ruleTypeLabel(event.event_type)}</p>
                <p className="vg-telemetry text-muted-foreground">
                  <time dateTime={event.started_at}>{utcStamp(event.started_at)}</time>
                </p>
                <p className="truncate text-body-sm">{cameraName(cameraNames, event.camera_id)}</p>
                <EventFacts event={event} />
                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  <SeverityBadge severity={event.severity} />
                  <StatusIndicator variant="inline" tone={statusTone(event.status)} label={event.status} />
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

function EventFacts({ event }: { event: Event }) {
  const missing = missingPpe(event);
  if (!event.object_class && !hasTrack(event) && missing.length === 0) return null;
  return (
    <p className="vg-telemetry mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
      {event.object_class && <span>{event.object_class}</span>}
      {hasTrack(event) && <span>TRACK #{event.track_id}</span>}
      {missing.length > 0 && <span className="text-danger-ink">Missing {missing.join(', ')}</span>}
    </p>
  );
}
