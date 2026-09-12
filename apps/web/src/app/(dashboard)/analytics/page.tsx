'use client';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { EventsChart } from '@/components/analytics/events-chart';
import { api } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        if (isMounted) setError(err.message || 'Failed to load analytics data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [timeRange]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <div className="w-48">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger>
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Card className="border-red-500">
          <CardContent className="pt-6 text-red-500">
            {error}
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </Card>
          <Card className="h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Event Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <EventsChart data={timeseries} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Event Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(distribution).length === 0 ? (
                <div className="text-muted-foreground text-center py-8">No events found</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(distribution).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
