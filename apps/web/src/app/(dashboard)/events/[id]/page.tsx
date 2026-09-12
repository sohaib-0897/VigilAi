'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { api } from '@/lib/api';
import { Event } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import Image from 'next/image';

export default function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchEvent = useCallback(() => {
    setLoading(true);
    api.getEvent(unwrappedParams.id)
      .then(setEvent)
      .catch(err => {
        console.error(err);
        setError('Failed to load event details');
      })
      .finally(() => setLoading(false));
  }, [unwrappedParams.id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleUpdateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await api.updateEventStatus(unwrappedParams.id, status);
      fetchEvent();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event) {
    return <div className="text-center p-12 text-destructive">{error || 'Event not found'}</div>;
  }

  // Assuming the API base URL is empty or points to same host via proxy. Just prepend /api/v1 or use directly.
  // We'll use the file_path directly if it's absolute, else construct it. We'll just construct a full URL for the image or use next/image with full path.
  // Actually, standard is to use a direct img src with the file_path or API endpoint for media.
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Event Details</h1>
        <div className="flex space-x-2">
          {event.status !== 'acknowledged' && event.status !== 'resolved' && (
            <Button 
              variant="outline" 
              onClick={() => handleUpdateStatus('acknowledged')}
              disabled={updating}
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Acknowledge
            </Button>
          )}
          {event.status !== 'resolved' && (
            <Button 
              onClick={() => handleUpdateStatus('resolved')}
              disabled={updating}
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Resolve
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><span className="font-medium">Type:</span> {event.event_type}</div>
            <div>
              <span className="font-medium">Severity:</span>{' '}
              <Badge variant={event.severity === 'critical' ? 'destructive' : 'default'}>
                {event.severity}
              </Badge>
            </div>
            <div><span className="font-medium">Time:</span> {new Date(event.created_at).toLocaleString()}</div>
            <div>
              <span className="font-medium">Status:</span>{' '}
              <Badge variant="outline">{event.status}</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm max-h-[200px]">
              {JSON.stringify(event.metadata, null, 2) || 'No metadata available'}
            </pre>
          </CardContent>
        </Card>
      </div>

      {event.evidences && event.evidences.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {event.evidences.map((evItem) => (
                <div key={evItem.id} className="border rounded-lg overflow-hidden flex flex-col">
                  <div className="relative aspect-video bg-muted">
                    {/* Assuming file_path contains the path we can fetch from the backend */}
                    <img 
                      src={`/api/v1/events/${event.id}/evidence/${evItem.id}/file`} 
                      alt="Evidence Snapshot" 
                      className="object-contain w-full h-full"
                      onError={(e) => {
                        // Fallback if the path is actually just the path itself
                        (e.target as HTMLImageElement).alt = "Evidence file unavailable";
                      }}
                    />
                  </div>
                  <div className="p-2 text-xs text-center text-muted-foreground bg-secondary">
                    {evItem.evidence_type} - {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
