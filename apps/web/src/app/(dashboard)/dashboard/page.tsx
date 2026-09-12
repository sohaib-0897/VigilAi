'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { OverviewStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Video, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/analytics/stat-card';

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
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center p-12 text-destructive">Failed to load dashboard statistics.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Cameras" 
          value={stats.total_cameras} 
          icon={<Video className="h-4 w-4" />} 
          trend={`${stats.active_cameras} active`}
        />
        <StatCard 
          title="Events Today" 
          value={stats.events_today} 
          icon={<Activity className="h-4 w-4" />} 
        />
        <StatCard 
          title="High Severity" 
          value={stats.high_severity_events} 
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />} 
        />
        <StatCard 
          title="People Count" 
          value={stats.people_count} 
          icon={<Users className="h-4 w-4" />} 
        />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader><CardTitle>Recent Events</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recent_events.length === 0 ? <p className="text-sm text-muted-foreground">No recent events.</p> : 
                stats.recent_events.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{ev.event_type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                    </div>
                    <div className={`text-xs font-semibold ${ev.severity === 'critical' ? 'text-red-500' : ev.severity === 'high' ? 'text-orange-500' : 'text-yellow-500'}`}>
                      {ev.severity.toUpperCase()}
                    </div>
                  </div>
                ))
              }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
