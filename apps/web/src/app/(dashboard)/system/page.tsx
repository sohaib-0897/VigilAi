'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { HealthCard } from '@/components/system/health-card';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Cpu, Server, Database, Radio, RefreshCw, Terminal, Layers } from 'lucide-react';

export default function SystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSystemData = async () => {
    try {
      const [h, m] = await Promise.all([
        api.getHealth(),
        api.getMetrics()
      ]);
      setHealth(h);
      setMetrics(m);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader
        tag="HARDWARE & DAEMON TELEMETRY"
        title="Infrastructure Health"
        description="Low-level heartbeat diagnostics, memory utilization, worker daemon status, and message broker connectivity."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSystemData}
            className="text-xs font-black"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
            Poll Heartbeats Now
          </Button>
        }
      />

      {loading && !health ? (
        <div className="flex h-48 items-center justify-center border-4 border-black bg-white shadow-neo-sm font-mono text-xs font-black uppercase">
          <span className="h-3 w-3 bg-black animate-ping mr-2" />
          INTERROGATING SUBSYSTEM DAEMONS...
        </div>
      ) : (
        <>
          {/* Subsystem Health Blocks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <HealthCard
              name="HTTP Gateway API"
              status={health?.status === 'healthy' ? 'healthy' : 'down'}
              details={health?.version ? `Version: ${health.version}` : 'Uvicorn ASGI Listener'}
            />
            <HealthCard
              name="PostgreSQL Vault"
              status={health?.details?.database === 'ok' ? 'healthy' : 'down'}
              details="Async SQLAlchemy 2.x"
            />
            <HealthCard
              name="Inference Worker"
              status={metrics?.workers > 0 ? 'healthy' : 'degraded'}
              details={metrics?.workers > 0 ? `${metrics.workers} Worker Daemon Active` : 'No Worker Heartbeat'}
            />
            <HealthCard
              name="Redis Message Broker"
              status={health?.details?.redis === 'ok' ? 'healthy' : 'down'}
              details="Telemetry Pub/Sub & Frame Cache"
            />
          </div>

          {/* Operational Metrics & Raw Health Diagnostic Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 Cols: Physical Host Metrics */}
            <Card className="lg:col-span-6 border-4 border-black bg-white shadow-neo-md">
              <CardHeader className="bg-neo-yellow p-4 border-b-2 border-black">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Cpu className="h-4 w-4" strokeWidth={2.5} />
                  Host Resource Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 font-mono text-xs space-y-3">
                {metrics ? (
                  <>
                    <div className="flex justify-between items-center border-b border-black/30 pb-2">
                      <span className="text-black/70 font-bold uppercase">CPU UTILIZATION:</span>
                      <span className="font-black text-black bg-neo-muted px-2 py-0.5 border border-black/40">
                        {metrics.cpu_usage_percent !== null && metrics.cpu_usage_percent !== undefined
                          ? `${metrics.cpu_usage_percent}%`
                          : "NOT_MEASURED"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-black/30 pb-2">
                      <span className="text-black/70 font-bold uppercase">MEMORY FOOTPRINT:</span>
                      <span className="font-black text-black bg-neo-muted px-2 py-0.5 border border-black/40">
                        {metrics.memory_usage_percent !== null && metrics.memory_usage_percent !== undefined
                          ? `${metrics.memory_usage_percent}%`
                          : "NOT_MEASURED"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-black/30 pb-2">
                      <span className="text-black/70 font-bold uppercase">CONCURRENT STREAMS:</span>
                      <span className="font-black text-black bg-neo-green px-2 py-0.5 border border-black">
                        {metrics.active_streams ?? "0"} ACTIVE
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-black/30 pb-2">
                      <span className="text-black/70 font-bold uppercase">PIPELINE THROUGHPUT:</span>
                      <span className="font-black text-black bg-neo-yellow px-2 py-0.5 border border-black">
                        {metrics.pipeline_fps !== null && metrics.pipeline_fps !== undefined
                          ? `${metrics.pipeline_fps} FPS`
                          : (metrics.frames_processed !== null && metrics.frames_processed !== undefined ? `${metrics.frames_processed} FRAMES` : "STANDBY")}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-black/30 pb-2">
                      <span className="text-black/70 font-bold uppercase">QUEUE BACKPRESSURE:</span>
                      <span className={`font-black px-2 py-0.5 border border-black ${metrics.frames_dropped ? 'bg-neo-red text-white' : 'bg-neo-cream text-black'}`}>
                        {metrics.frames_dropped !== null && metrics.frames_dropped !== undefined
                          ? `${metrics.frames_dropped} DROPPED`
                          : "0 DROPPED (FRESH)"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-black/70 font-bold uppercase">INGEST EVENT RATE:</span>
                      <span className="font-black text-black">
                        {metrics.events_per_minute !== null && metrics.events_per_minute !== undefined
                          ? `${metrics.events_per_minute} EVT/MIN`
                          : "NOT_MEASURED"}
                      </span>
                    </div>

                  </>
                ) : (
                  <div className="p-6 text-center text-black/60 font-mono text-xs uppercase border border-dashed border-black/40">
                    Host metrics daemon unreachable
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right 6 Cols: Raw Terminal Diagnostic Dump */}
            <Card className="lg:col-span-6 border-4 border-black bg-white shadow-neo-md">
              <CardHeader className="bg-neo-cream p-4 border-b-2 border-black">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" strokeWidth={2.5} />
                  Raw Subsystem Diagnostic Ping
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <pre className="border-2 border-black bg-black text-neo-green p-3 font-mono text-[11px] overflow-auto max-h-[220px] shadow-[2px_2px_0px_#000000]">
                  {JSON.stringify(health, null, 2) || '{\n  "status": "DISCONNECTED"\n}'}
                </pre>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
