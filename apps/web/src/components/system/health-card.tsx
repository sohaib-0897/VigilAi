import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface HealthCardProps {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  details?: string
  className?: string
}

export function HealthCard({ name, status, details, className }: HealthCardProps) {
  const isHealthy = status === 'healthy';
  const isDegraded = status === 'degraded';

  let statusBg = "bg-neo-green text-black";
  let Icon = CheckCircle2;
  if (isDegraded) {
    statusBg = "bg-neo-yellow text-black";
    Icon = Activity;
  } else if (!isHealthy) {
    statusBg = "bg-neo-red text-white";
    Icon = AlertOctagon;
  }

  return (
    <Card className={cn("border-2 sm:border-4 border-black bg-white shadow-neo-sm sm:shadow-neo-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between border-b-2 border-black p-3 bg-neo-cream">
        <CardTitle className="text-xs font-black uppercase tracking-wider text-black">
          {name}
        </CardTitle>
        <span className={cn("inline-flex items-center gap-1 border border-black px-2 py-0.5 text-[10px] font-black uppercase", statusBg)}>
          <Icon className="h-3 w-3" strokeWidth={3} />
          <span>{status.toUpperCase()}</span>
        </span>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        <div className="text-2xl font-black uppercase tracking-tight text-black font-mono">
          {isHealthy ? "ONLINE / READY" : isDegraded ? "DEGRADED STATE" : "SUBSYSTEM DOWN"}
        </div>
        {details && (
          <div className="text-[11px] font-mono font-bold text-black/70 bg-neo-muted p-1.5 border border-black/30 truncate">
            {details}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
