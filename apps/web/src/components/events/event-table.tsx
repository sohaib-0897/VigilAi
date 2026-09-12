import { Event } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export function EventTable({ events }: { events: Event[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Camera ID</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((ev) => (
          <TableRow key={ev.id}>
            <TableCell>{new Date(ev.created_at).toLocaleString()}</TableCell>
            <TableCell>
              <Link href={`/events/${ev.id}`} className="text-primary hover:underline">{ev.event_type}</Link>
            </TableCell>
            <TableCell>
              <Badge variant={ev.severity === 'critical' ? 'destructive' : 'default'}>{ev.severity}</Badge>
            </TableCell>
            <TableCell>{ev.camera_id}</TableCell>
            <TableCell>{ev.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
