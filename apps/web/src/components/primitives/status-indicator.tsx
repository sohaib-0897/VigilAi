import * as React from 'react';
import { cn } from '@/lib/utils';
import { isLiveTone, toneDot, toneFill, type Tone } from '@/lib/status';

type StatusIndicatorProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone: Tone;
  label: React.ReactNode;
  /** `chip` = filled tag (tables, headers); `inline` = dot + text (dense rows, telemetry). */
  variant?: 'chip' | 'inline';
  /** Blink the dot for live states. Ignored for non-live tones and under reduced motion. */
  live?: boolean;
};

/**
 * Operational state readout. Colour is always paired with a text label so the
 * state is never communicated by colour alone.
 */
export function StatusIndicator({ tone, label, variant = 'chip', live = false, className, ...props }: StatusIndicatorProps) {
  const dot = (
    <span
      aria-hidden="true"
      className={cn(
        'h-1.5 w-1.5 shrink-0',
        variant === 'chip' ? 'bg-current' : toneDot[tone],
        live && isLiveTone(tone) && 'motion-safe:animate-signal-blink',
      )}
    />
  );

  if (variant === 'inline') {
    return (
      <span className={cn('vg-label inline-flex items-center gap-2 text-foreground', className)} {...props}>
        {dot}
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'vg-label inline-flex h-6 select-none items-center gap-1.5 whitespace-nowrap border px-2 font-medium',
        toneFill[tone],
        className,
      )}
      {...props}
    >
      {dot}
      {label}
    </span>
  );
}
