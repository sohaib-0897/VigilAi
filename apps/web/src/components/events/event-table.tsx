import { Event } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export function EventTable({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="border-2 border-black bg-white p-8 text-center shadow-neo-sm">
        <p className="font-mono text-xs font-black uppercase tracking-wider text-black/60">
          No security events logged under current filter criteria
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">Timestamp</TableHead>
          <TableHead>Event Type</TableHead>
          <TableHead className="w-[120px]">Severity</TableHead>
          <TableHead>Target Camera</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[80px] text-right">Review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((ev) => (
          <TableRow key={ev.id} className="hover:bg-neo-cream/70">
            <TableCell className="font-mono text-xs font-bold text-black/80">
              {new Date(ev.created_at).toISOString().replace('T', ' ').substring(0, 19)}
            </TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                <span className="font-black uppercase tracking-tight text-black text-xs sm:text-sm">
                  {ev.event_type.replace('_', ' ')}
                </span>
                {ev.track_id !== null && ev.track_id !== undefined && (
                  <span className="font-mono text-[10px] bg-neo-muted border border-black/40 px-1 py-0.2 font-bold text-black">
                    TRK #{ev.track_id}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <SeverityBadge severity={ev.severity} />
            </TableCell>
            <TableCell className="font-mono text-xs font-bold truncate max-w-[150px]">
              {ev.camera_id}
            </TableCell>
            <TableCell>
              <StatusBadge status={ev.status} showPulse={false} />
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/events/${ev.id}`}
                className="inline-flex items-center justify-center border-2 border-black bg-white hover:bg-neo-yellow p-1 shadow-[2px_2px_0px_#000000] text-black transition-colors"
                title="Inspect Evidence"
              >
                <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
