import * as React from 'react';
import { cn } from '@/lib/utils';

type PanelProps = {
  title: React.ReactNode;
  /** Id for the `h2`, referenced by the section's `aria-labelledby`. */
  labelId: string;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** Console content panel: ink-framed surface with a titled header rail. */
export function Panel({ title, labelId, meta, className, children }: PanelProps) {
  return (
    <section aria-labelledby={labelId} className={cn('flex min-w-0 flex-col border border-border-strong bg-surface', className)}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border-strong px-4">
        <h2 id={labelId} className="font-display text-title font-semibold">{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}
