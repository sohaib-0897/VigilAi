'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { HealthCard } from '@/components/system/health-card';

export default function SystemPage() {
  const [health, setHealth] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchSystemData = async () => {
      try {
        const [h, m] = await Promise.all([
          api.getHealth(),
          api.getMetrics()
        ]);
        if (mounted) {
          setHealth(h);
          setMetrics(m);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setLoading(false);
      }
    };

    fetchSystemData();
    const interval = setInterval(fetchSystemData, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">System Status</h1>
      
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <HealthCard 
              name="API Server" 
              status={health?.status === 'healthy' ? 'healthy' : 'down'} 
              details={health?.version ? `Version: ${health.version}` : undefined}
            />
            <HealthCard 
              name="Database" 
              status={health?.details?.database === 'ok' ? 'healthy' : 'down'} 
            />
            <HealthCard 
              name="Inference Engine" 
              status={metrics?.workers > 0 ? 'healthy' : 'degraded'} 
            />
            <HealthCard 
              name="Message Queue" 
              status={health?.details?.redis === 'ok' ? 'healthy' : 'down'} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>System Metrics</CardTitle></CardHeader>
              <CardContent>
                {metrics ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-muted-foreground">CPU Usage</span>
                      <span className="font-semibold">{metrics.cpu_usage_percent ?? "NOT_MEASURED"}%</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-muted-foreground">Memory Usage</span>
                      <span className="font-semibold">{metrics.memory_usage_percent ?? "NOT_MEASURED"}%</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-muted-foreground">Active Streams</span>
                      <span className="font-semibold">{metrics.active_streams ?? "NOT_MEASURED"}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-muted-foreground">Events/min</span>
                      <span className="font-semibold">{metrics.events_per_minute ?? "NOT_MEASURED"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center">No metrics available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Raw Health Data</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto h-48">
                  {JSON.stringify(health, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
