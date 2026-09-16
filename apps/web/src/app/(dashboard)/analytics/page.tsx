'use client';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EventsChart } from '@/components/analytics/events-chart';
import { SectionHeader } from '@/components/ui/section-header';
import { api } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, PieChart, Clock, AlertTriangle } from 'lucide-react';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    const fetchData = async () => {
      try {
        const end = new Date();
        const start = new Date();
        if (timeRange === '7d') start.setDate(end.getDate() - 7);
        else if (timeRange === '30d') start.setDate(end.getDate() - 30);
        else if (timeRange === '24h') start.setHours(end.getHours() - 24);

        const params = { start: start.toISOString(), end: end.toISOString() };

        const [tsData, distData] = await Promise.all([
          api.getTimeseries(params),
          api.getDistribution(params)
        ]);

        if (isMounted) {
          setTimeseries(tsData);
          setDistribution(distData);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to aggregate surveillance analytics');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [timeRange]);

  const totalEvents = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        tag="AGGREGATED INTELLIGENCE"
        title="Surveillance Analytics"
        description="Historical event distributions, temporal traffic density curves, and spatial rule firing metrics."
        action={
          <div className="flex items-center gap-2 border-2 border-black bg-white p-1.5 shadow-neo-sm">
            <Clock className="h-4 w-4 ml-1.5 text-black" strokeWidth={2.5} />
            <span className="text-xs font-black uppercase tracking-wider text-black">Window:</span>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-black">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">LAST 24 HOURS</SelectItem>
                <SelectItem value="7d">LAST 7 DAYS</SelectItem>
                <SelectItem value="30d">LAST 30 DAYS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {error ? (
        <div className="border-4 border-black bg-neo-red p-4 text-white text-xs font-black uppercase shadow-neo-sm flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={3} />
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-[380px] border-4 border-black bg-white shadow-neo-md flex items-center justify-center font-mono text-xs font-black uppercase">
            <span className="h-3 w-3 bg-black animate-ping mr-2" />
            COMPUTING TEMPORAL METRICS...
          </div>
          <div className="lg:col-span-4 h-[380px] border-4 border-black bg-white shadow-neo-md flex items-center justify-center font-mono text-xs font-black uppercase">
            <span className="h-3 w-3 bg-black animate-ping mr-2" />
            COMPUTING DISTRIBUTIONS...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Timeseries Area (8 Cols) */}
          <Card className="lg:col-span-8 border-4 border-black bg-white shadow-neo-md">
            <CardHeader className="bg-neo-violet p-4 border-b-2 border-black flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" strokeWidth={2.5} />
                Temporal Incident Frequency
              </CardTitle>
              <span className="font-mono text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase">
                {timeRange.toUpperCase()} LOG WINDOW
              </span>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <EventsChart data={timeseries} />
            </CardContent>
          </Card>

          {/* Categorical Distribution Breakdown (4 Cols) */}
          <Card className="lg:col-span-4 border-4 border-black bg-white shadow-neo-md flex flex-col justify-between">
            <div>
              <CardHeader className="bg-neo-yellow p-4 border-b-2 border-black">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <PieChart className="h-4 w-4" strokeWidth={2.5} />
                  Trigger Type Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {Object.keys(distribution).length === 0 ? (
                  <div className="text-center font-mono text-xs text-black/60 uppercase py-12 border border-dashed border-black/40">
                    No incident triggers recorded in window
                  </div>
                ) : (
                  <div className="space-y-3 font-mono text-xs">
                    {Object.entries(distribution).map(([type, count]) => {
                      const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                      return (
                        <div key={type} className="space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="uppercase text-black">{type.replace('_', ' ')}</span>
                            <span className="bg-black text-white px-1.5 py-0.2 text-[10px] font-black">
                              {count} ({pct}%)
                            </span>
                          </div>
                          {/* Proportional Bar */}
                          <div className="h-2 w-full border border-black bg-neo-muted overflow-hidden">
                            <div
                              className="h-full bg-neo-yellow border-r border-black"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </div>

            <div className="p-4 border-t-2 border-black bg-neo-cream font-mono text-xs flex justify-between items-center">
              <span className="font-bold text-black/70 uppercase">AGGREGATE VOLUME:</span>
              <span className="font-black text-sm bg-neo-yellow px-2 py-0.5 border border-black">
                {totalEvents} EVENTS
              </span>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
