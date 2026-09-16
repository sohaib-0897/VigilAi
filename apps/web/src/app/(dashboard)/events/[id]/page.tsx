'use client';
import { useEffect, useState, use, useCallback } from 'react';
import { api } from '@/lib/api';
import { Event } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Loader2, CheckCircle, Clock, ArrowLeft, Camera, ShieldAlert, FileText, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

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
        setError('Failed to load incident record. Verify network connection.');
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
      <div className="flex h-64 items-center justify-center border-4 border-black bg-white shadow-neo-sm font-mono text-xs font-black uppercase">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        RETRIEVING INCIDENT EVIDENCE DOSSIER...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="border-4 border-black bg-neo-red p-6 text-white shadow-neo-md font-mono text-xs font-black uppercase">
        {error || 'INCIDENT RECORD NOT FOUND'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        tag={`INCIDENT #${event.id.substring(0, 8)}`}
        title={event.event_type.replace('_', ' ')}
        description={`Logged at ${new Date(event.created_at).toISOString().replace('T', ' ').substring(0, 19)} UTC · Camera Node: ${event.camera_id}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/events">
              <Button variant="outline" size="sm" className="text-xs font-black">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                Incident Log
              </Button>
            </Link>

            {event.status !== 'acknowledged' && event.status !== 'resolved' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleUpdateStatus('acknowledged')}
                disabled={updating}
                className="text-xs font-black"
              >
                {updating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clock className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.5} />}
                Acknowledge Incident
              </Button>
            )}

            {event.status !== 'resolved' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleUpdateStatus('resolved')}
                disabled={updating}
                className="text-xs font-black bg-black text-white hover:bg-neo-green hover:text-black"
              >
                {updating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.5} />}
                Resolve & Close
              </Button>
            )}
          </div>
        }
      />

      {/* Two Columns: Information Breakdown + Structured Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 border-4 border-black bg-white shadow-neo-md">
          <CardHeader className="bg-neo-yellow p-4 border-b-2 border-black">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" strokeWidth={2.5} />
              Incident Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-black/30 pb-2">
              <span className="text-black/70 font-bold">SEVERITY RANKING:</span>
              <SeverityBadge severity={event.severity} />
            </div>

            <div className="flex justify-between border-b border-black/30 pb-2">
              <span className="text-black/70 font-bold">LIFECYCLE STATUS:</span>
              <StatusBadge status={event.status} showPulse={false} />
            </div>

            <div className="flex justify-between border-b border-black/30 pb-2">
              <span className="text-black/70 font-bold">TRACKED OBJECT ID:</span>
              <span className="font-black bg-neo-muted px-1.5 border border-black/40">
                {event.track_id !== null && event.track_id !== undefined ? `TRK #${event.track_id}` : 'N/A (Spatial / Density)'}
              </span>
            </div>

            <div className="flex justify-between border-b border-black/30 pb-2">
              <span className="text-black/70 font-bold">DETECTION CLASS:</span>
              <span className="font-black uppercase text-black">
                {event.object_class || (event.metadata?.class_name ?? 'NOT_SPECIFIED')}
              </span>
            </div>

            <div className="flex justify-between border-b border-black/30 pb-2">
              <span className="text-black/70 font-bold">TARGET CAMERA NODE:</span>
              <Link
                href={`/cameras/${event.camera_id}`}
                className="font-black underline hover:text-neo-red truncate max-w-[200px]"
              >
                {event.camera_id}
              </Link>
            </div>

            <div className="flex justify-between pt-1">
              <span className="text-black/70 font-bold">UTC LOG TIMESTAMP:</span>
              <span className="font-bold text-black">
                {new Date(event.created_at).toISOString().replace('T', ' ').substring(0, 19)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Structured Metadata Inspector */}
        <Card className="lg:col-span-6 border-4 border-black bg-white shadow-neo-md">
          <CardHeader className="bg-neo-cream p-4 border-b-2 border-black">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              <FileText className="h-4 w-4" strokeWidth={2.5} />
              Telemetry Context Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <pre className="border-2 border-black bg-neo-bg p-3 font-mono text-[11px] text-black overflow-auto max-h-[220px] shadow-[2px_2px_0px_#000000]">
              {JSON.stringify(event.metadata, null, 2) || '{\n  "metadata": "None captured"\n}'}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Captured Evidence Section */}
      {event.evidences && event.evidences.length > 0 && (
        <Card className="border-4 border-black bg-white shadow-neo-md">
          <CardHeader className="bg-black text-white p-4 border-b-2 border-black">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-neo-yellow" strokeWidth={2.5} />
              Preserved Surveillance Evidence ({event.evidences.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {event.evidences.map((evItem) => (
                <div key={evItem.id} className="border-2 border-black bg-white shadow-neo-sm overflow-hidden flex flex-col">
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={`/api/v1/events/${event.id}/evidence`}
                      alt="Annotated Forensic Snapshot"
                      className="object-contain w-full h-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `/api/v1/events/${event.id}/evidence/${evItem.id}/file`;
                      }}
                    />
                  </div>
                  <div className="p-2.5 bg-neo-cream border-t-2 border-black font-mono text-[10px] font-black uppercase flex items-center justify-between">
                    <span>{evItem.evidence_type} SNAPSHOT</span>
                    <span className="text-black/60">TRK #{event.track_id ?? 'N/A'}</span>
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
