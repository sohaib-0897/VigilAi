'use client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CustomTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="border-2 border-black bg-white p-2 shadow-neo-sm">
        <p className="font-mono text-xs font-black uppercase tracking-wider text-black">{label}</p>
        <p className="font-mono text-sm font-black text-black">
          EVENTS: <span className="bg-neo-yellow px-1 border border-black">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
}

export function EventsChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-black font-bold uppercase text-xs border-2 border-dashed border-black bg-neo-cream p-4">
        <span className="bg-neo-yellow px-2 py-1 border border-black mb-1">NO TELEMETRY RECORDED</span>
        <span className="text-[10px] text-black/60 font-mono">Select a different temporal range</span>
      </div>
    );
  }

  return (
    <div className="h-72 w-full p-2 bg-white">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#000000" strokeOpacity={0.15} strokeDasharray="4 4" />
          <XAxis
            dataKey="period"
            stroke="#000000"
            strokeWidth={1.5}
            tick={{ fill: '#000000', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}
          />
          <YAxis
            stroke="#000000"
            strokeWidth={1.5}
            tick={{ fill: '#000000', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#000000"
            strokeWidth={3}
            fill="#FFD93D"
            fillOpacity={0.8}
            activeDot={{ r: 6, stroke: '#000000', strokeWidth: 2, fill: '#FF5C5C' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
