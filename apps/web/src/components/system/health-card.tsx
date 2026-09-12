import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function HealthCard({ name, status, details }: { name: string, status: 'healthy' | 'degraded' | 'down', details?: string }) {
  const color = status === 'healthy' ? 'bg-green-500' : status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
        <div className={`w-3 h-3 rounded-full ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold capitalize">{status}</div>
        {details && <p className="text-xs text-muted-foreground mt-1">{details}</p>}
      </CardContent>
    </Card>
  );
}
