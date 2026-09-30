import * as React from 'react';
import { cn } from '@/lib/utils';

type MetricDisplayProps = React.HTMLAttributes<HTMLDivElement> & {
  label: React.ReactNode;
  /** `null`/`undefined` renders NOT_MEASURED — never substitute a placeholder number. */
  value: React.ReactNode | null | undefined;
  unit?: string;
  /** Provenance or measurement conditions, e.g. "CPU · 512px · 200 runs". */
  context?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

const valueSize = {
  sm: 'text-2xl',
  md: 'text-[clamp(2rem,1.5rem+2vw,3rem)]',
  lg: 'text-display-md',
} as const;

/**
 * A single measured value with label, unit and provenance. Uses tabular mono
 * digits so live values do not jitter as they update.
 */
export function MetricDisplay({ label, value, unit, context, size = 'md', className, ...props }: MetricDisplayProps) {
  const measured = value !== null && value !== undefined && value !== '';
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)} {...props}>
      <span className="vg-label text-muted-foreground">{label}</span>
      {measured ? (
        <span className={cn('font-display font-semibold leading-none tracking-[-0.03em] tabular', valueSize[size])}>
          {value}
          {unit && <span className="ml-1 font-mono text-[0.4em] font-medium tracking-normal text-muted-foreground">{unit}</span>}
        </span>
      ) : (
        <span className="vg-telemetry text-muted-foreground" title="This value has not been measured">NOT_MEASURED</span>
      )}
      {context && <span className="vg-telemetry text-muted-foreground">{context}</span>}
    </div>
  );
}
