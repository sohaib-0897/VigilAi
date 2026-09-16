'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { OverviewStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/analytics/stat-card';
import { SectionHeader } from '@/components/ui/section-header';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Button } from '@/components/ui/button';
import { Activity, Video, AlertTriangle, Users, ArrowUpRight, Radio, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = () => {
      api.getOverview()
        .then(setStats)
        .catch(console.error)
        .finally(() => setLoading(false));
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-3">
        <div className="border-4 border-black bg-neo-yellow p-6 font-mono text-xs font-black uppercase tracking-wider shadow-neo-lg flex items-center space-x-3">
          <span className="h-3 w-3 bg-black animate-ping" />
          <span>SYNCHRONIZING OPERATIONAL TELEMETRY...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="border-4 border-black bg-neo-red p-6 text-white shadow-neo-md">
        <div className="flex items-center space-x-2 font-black text-sm uppercase tracking-wider">
          <AlertTriangle className="h-5 w-5" strokeWidth={3} />
          <span>Telemetric Link Interrupted — Failed to poll overview statistics</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <SectionHeader
        tag="LIVE COMMAND CONSOLE"
        title="Surveillance Overview"
        description="Real-time multi-stream telemetry, detection counters, and stateful event monitoring across all active video feeds."
        action={
          <div className="flex items-center gap-2">
            <Link href="/cameras">
              <Button variant="secondary" size="sm" className="text-xs font-black">
                <Video className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
                Cameras ({stats.total_cameras})
              </Button>
            </Link>
            <Link href="/events">
              <Button variant="destructive" size="sm" className="text-xs font-black">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
                Alerts ({stats.high_severity_events})
              </Button>
            </Link>
          </div>
        }
      />

      {/* Hero Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monitored Nodes"
          value={stats.total_cameras}
          icon={<Video className="h-5 w-5 text-black" strokeWidth={2.5} />}
          trend={`${stats.active_cameras} PIPELINES ONLINE`}
          colorBand="yellow"
        />
        <StatCard
          title="Incidents (24H)"
          value={stats.events_today}
          icon={<Activity className="h-5 w-5 text-white" strokeWidth={2.5} />}
          trend="STATEFUL EVENTS LOGGED"
          colorBand="black"
        />
        <StatCard
          title="High Severity"
          value={stats.high_severity_events}
          icon={<AlertTriangle className="h-5 w-5 text-white" strokeWidth={2.5} />}
          trend="BREACHES & ALERTS"
          colorBand="red"
        />
        <StatCard
          title="Tracked Entities"
          value={stats.people_count}
          icon={<Users className="h-5 w-5 text-black" strokeWidth={2.5} />}
          trend="PERSISTENT OBJECT IDS"
          colorBand="violet"
        />
      </div>

      {/* Two-Column Grid: Live Recent Incidents + Console Activity */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 8 Cols: Recent Security Events */}
        <Card className="lg:col-span-8 border-4 border-black bg-white shadow-neo-md">
          <CardHeader className="bg-neo-cream p-4 border-b-2 border-black flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-neo-red border border-black animate-pulse" />
              <CardTitle className="text-sm font-black uppercase tracking-wider text-black">
                Recent Security Incidents
              </CardTitle>
            </div>
            <Link
              href="/events"
              className="text-[11px] font-mono font-bold uppercase underline hover:text-neo-red transition-colors flex items-center"
            >
              Full Incident Log <ArrowUpRight className="h-3 w-3 ml-0.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 divide-y-2 divide-black/80">
            {stats.recent_events.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-black/60 uppercase">
                Zero security events recorded today. Surveillance perimeter secure.
              </div>
            ) : (
              stats.recent_events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 sm:p-4 flex items-center justify-between gap-4 hover:bg-neo-cream transition-colors"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="h-8 w-8 border-2 border-black bg-neo-yellow text-black flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-black uppercase text-xs sm:text-sm tracking-tight text-black truncate">
                          {ev.event_type.replace('_', ' ')}
                        </p>
                        {ev.track_id !== null && ev.track_id !== undefined && (
                          <span className="font-mono text-[9px] bg-black text-white px-1 font-bold">
                            ID #{ev.track_id}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs font-mono text-black/60 mt-0.5">
                        {new Date(ev.created_at).toISOString().replace('T', ' ').substring(0, 19)} UTC · Node: {ev.camera_id?.substring(0, 8)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <SeverityBadge severity={ev.severity} />
                    <Link
                      href={`/events/${ev.id}`}
                      className="border border-black bg-white hover:bg-neo-yellow p-1 shadow-[2px_2px_0px_#000000] text-black"
                      title="Inspect Evidence"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right 4 Cols: Technical Diagnostic Status */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-4 border-black bg-white shadow-neo-md">
            <CardHeader className="bg-neo-yellow p-4 border-b-2 border-black">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <Radio className="h-4 w-4" strokeWidth={2.5} />
                Subsystem Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-black/30 pb-2">
                <span className="text-black/70 font-bold">DETECTOR:</span>
                <span className="font-black bg-neo-green px-1.5 py-0.5 border border-black text-[10px]">
                  YOLOv8n / PyTorch
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-black/30 pb-2">
                <span className="text-black/70 font-bold">TRACKER:</span>
                <span className="font-black bg-neo-green px-1.5 py-0.5 border border-black text-[10px]">
                  ByteTrack / Kalman
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-black/30 pb-2">
                <span className="text-black/70 font-bold">BACKPRESSURE:</span>
                <span className="font-black bg-white px-1.5 py-0.5 border border-black text-[10px]">
                  Bounded FIFO (Drop Old)
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-black/70 font-bold">EVIDENCE VAULT:</span>
                <span className="font-black bg-neo-cream px-1.5 py-0.5 border border-black text-[10px]">
                  JPEG + PostgreMeta
                </span>
              </div>

              <div className="pt-2">
                <Link href="/system" className="block w-full">
                  <Button variant="outline" size="sm" className="w-full text-xs font-black">
                    Diagnostic Telemetry Console
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
