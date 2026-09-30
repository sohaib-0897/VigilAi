import * as React from 'react';
import { cn } from '@/lib/utils';

type ViewportFrameProps = React.HTMLAttributes<HTMLElement> & {
  /** Top-left readout, e.g. "CAM-02 / NORTH GATE". */
  label?: React.ReactNode;
  /** Top-right readout, e.g. status indicator or frame index. */
  meta?: React.ReactNode;
  /** Bottom rail content, e.g. resolution, timestamp, caption. */
  footer?: React.ReactNode;
  /** Draw optical corner brackets around the media area. */
  brackets?: boolean;
  as?: 'div' | 'figure' | 'section';
};

/**
 * Instrument frame for camera feeds, evidence snapshots and schematic figures:
 * hairline border, mono header/footer rails, optional tracking brackets.
 * The media area is a plain block — children control their own aspect ratio.
 */
export function ViewportFrame({ label, meta, footer, brackets = true, as: Tag = 'div', className, children, ...props }: ViewportFrameProps) {
  return (
    <Tag className={cn('flex flex-col border border-border-strong bg-surface', className)} {...props}>
      {(label || meta) && (
        <div className="flex min-h-9 items-center justify-between gap-3 border-b border-border-strong px-3 py-1.5">
          <span className="vg-label truncate text-foreground">{label}</span>
          {meta && <span className="flex shrink-0 items-center gap-2">{meta}</span>}
        </div>
      )}
      <div className={cn('relative min-h-0 flex-1', brackets && 'vg-brackets [--bracket-inset:8px] [--bracket-size:14px]')}>
        {children}
      </div>
      {footer && (
        <div className="vg-telemetry flex min-h-8 items-center justify-between gap-3 border-t border-border px-3 py-1.5 text-muted-foreground">
          {footer}
        </div>
      )}
    </Tag>
  );
}
