'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bucketLabel, type Bucket, type BucketUnit } from './buckets';

/** SVG attributes cannot read CSS variables, so resolve the colour tokens once mounted. */
function useTokens() {
  const [tokens, setTokens] = useState({ ink: 'currentColor', muted: 'currentColor', rule: 'currentColor', highlight: 'currentColor' });
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const hsl = (name: string) => `hsl(${css.getPropertyValue(name).trim()})`;
    setTokens({ ink: hsl('--foreground'), muted: hsl('--muted-foreground'), rule: hsl('--border'), highlight: hsl('--muted') });
  }, []);
  return tokens;
}

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Bucket }[]; unit: BucketUnit }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="border border-border-strong bg-popover px-3 py-2 shadow-overlay">
      <p className="vg-telemetry text-muted-foreground">{bucketLabel(bucket.start, unit)}</p>
      <p className="text-body-sm font-semibold tabular">{bucket.count} {bucket.count === 1 ? 'event' : 'events'}</p>
    </div>
  );
}

/**
 * Event count per UTC bucket. Decorative to assistive technology: the same
 * numbers are in the summary sentence and the data table beside it.
 */
export function EventsChart({ buckets, unit }: { buckets: Bucket[]; unit: BucketUnit }) {
  const t = useTokens();
  const tick = { fill: t.muted, fontSize: 11, fontFamily: 'var(--font-mono)' };

  return (
    <div className="h-72 w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 12, right: 8, left: -12, bottom: 0 }} barCategoryGap={unit === 'hour' ? 2 : 4}>
          <CartesianGrid stroke={t.rule} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="start"
            tickFormatter={(v: number) => bucketLabel(v, unit, 'axis')}
            tick={tick}
            stroke={t.rule}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={tick} stroke={t.rule} tickLine={false} width={44} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: t.highlight }} isAnimationActive={false} />
          <Bar dataKey="count" fill={t.ink} isAnimationActive={false} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
