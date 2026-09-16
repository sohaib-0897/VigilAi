import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  trend?: string
  colorBand?: 'yellow' | 'red' | 'green' | 'violet' | 'black'
  className?: string
}

export function StatCard({ title, value, icon, trend, colorBand = 'yellow', className }: StatCardProps) {
  let headerBg = "bg-neo-yellow"
  switch (colorBand) {
    case 'red':
      headerBg = "bg-neo-red text-white"
      break
    case 'green':
      headerBg = "bg-neo-green text-black"
      break
    case 'violet':
      headerBg = "bg-neo-violet text-black"
      break
    case 'black':
      headerBg = "bg-black text-white"
      break
    case 'yellow':
    default:
      headerBg = "bg-neo-yellow text-black"
      break
  }

  return (
    <Card className={cn("border-2 sm:border-4 border-black bg-white shadow-neo-sm sm:shadow-neo-md", className)}>
      <CardHeader className={cn("flex flex-row items-center justify-between border-b-2 border-black p-3 py-2 sm:px-4", headerBg)}>
        <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-[0.14em]">
          {title}
        </CardTitle>
        {icon && <div className="shrink-0">{icon}</div>}
      </CardHeader>
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between">
        <div className="text-3xl sm:text-5xl font-black tracking-tight text-black font-mono">
          {value}
        </div>
        {trend && (
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider text-black/75 bg-neo-muted px-2 py-0.5 border border-black/40 w-fit">
            <span>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
