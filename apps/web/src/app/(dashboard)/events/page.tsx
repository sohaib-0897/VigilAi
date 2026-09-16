'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Event } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EventTable } from '@/components/events/event-table';
import { SectionHeader } from '@/components/ui/section-header';
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, Filter, Download } from 'lucide-react';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [severity, setSeverity] = useState<string>('all');

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(format);
      const blob = await api.exportEvents({ format, severity });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vigilai_events_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    const filters: any = { page, page_size: pageSize };
    if (severity !== 'all') {
      filters.severity = severity;
    }

    api.getEvents(filters)
      .then(res => {
        setEvents(res.items);
        setTotalPages(res.pages || 1);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to query event history. Verify API telemetry connection.');
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, severity]);

  return (
    <div className="space-y-6">
      <SectionHeader
        tag="STATEFUL EVENT VAULT"
        title="Security Incidents"
        description="Review deduplicated, stateful surveillance alerts. Each incident is captured with bounding boxes, persistent track IDs, and reviewable evidence snapshots."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 border-2 border-black bg-white p-1.5 shadow-neo-sm">
              <Filter className="h-4 w-4 ml-1.5 text-black" strokeWidth={2.5} />
              <span className="text-xs font-black uppercase tracking-wider text-black">Filter Severity:</span>
              <Select
                value={severity}
                onValueChange={(val) => {
                  setSeverity(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs font-black">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL SEVERITIES</SelectItem>
                  <SelectItem value="low">LOW ONLY</SelectItem>
                  <SelectItem value="medium">MEDIUM ONLY</SelectItem>
                  <SelectItem value="high">HIGH ONLY</SelectItem>
                  <SelectItem value="critical">CRITICAL ONLY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-11 border-2 border-black bg-white font-mono text-xs font-black uppercase shadow-neo-sm hover:bg-neo-yellow hover:text-black"
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
              >
                <Download className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                {exporting === 'csv' ? 'EXPORTING...' : 'CSV DOSSIER'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-11 border-2 border-black bg-white font-mono text-xs font-black uppercase shadow-neo-sm hover:bg-neo-yellow hover:text-black"
                onClick={() => handleExport('json')}
                disabled={exporting !== null}
              >
                <Download className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                {exporting === 'json' ? 'EXPORTING...' : 'JSON'}
              </Button>
            </div>
          </div>
        }
      />


      {error && (
        <div className="border-2 border-black bg-neo-red p-4 text-white text-xs font-black uppercase shadow-neo-sm flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={3} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Event Table Container */}
      {loading ? (
        <div className="flex h-48 items-center justify-center border-4 border-black bg-white shadow-neo-sm font-mono text-xs font-black uppercase">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          QUERYING PERSISTED INCIDENT LOGS...
        </div>
      ) : (
        <div className="space-y-4">
          <EventTable events={events} />

          {/* Pagination Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-white p-3 shadow-neo-sm font-mono text-xs">
            <div className="font-bold uppercase text-black/70">
              PAGE <span className="font-black text-black">{page}</span> OF <span className="font-black text-black">{totalPages}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 text-xs font-black"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" strokeWidth={3} />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-8 text-xs font-black"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" strokeWidth={3} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
