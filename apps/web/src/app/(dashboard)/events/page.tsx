'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Event } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EventTable } from '@/components/events/event-table';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [severity, setSeverity] = useState<string>('all');
  
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
        setError('Failed to load events');
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, severity]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Events</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Severity:</span>
          <Select value={severity} onValueChange={(val) => { setSeverity(val); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-12 text-center text-destructive">{error}</div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No events found.</div>
          ) : (
            <EventTable events={events} />
          )}
        </CardContent>
      </Card>

      {!loading && events.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
