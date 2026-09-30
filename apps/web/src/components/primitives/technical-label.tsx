import * as React from 'react';
import { cn } from '@/lib/utils';

type TechnicalLabelProps = React.HTMLAttributes<HTMLElement> & {
  /** Section or sequence index, rendered as a boxed prefix: `01`. */
  index?: string;
  /** Emphasis: `plain` (muted text), `strong` (ink), `signal` (lime chip index). */
  tone?: 'plain' | 'strong' | 'signal';
  as?: 'p' | 'span' | 'div' | 'dt' | 'figcaption';
};

/**
 * Mono uppercase label for eyebrows, section indices, figure captions and
 * telemetry keys. The one place that defines the "technical label" voice.
 */
export function TechnicalLabel({ index, tone = 'plain', as: Tag = 'p', className, children, ...props }: TechnicalLabelProps) {
  return (
    <Tag
      className={cn(
        'vg-label inline-flex items-center gap-2',
        tone === 'plain' ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
      {...props}
    >
      {index && (
        <span
          className={cn(
            'border px-1.5 py-px tabular',
            tone === 'signal' ? 'border-border-strong bg-signal text-signal-foreground' : 'border-current',
          )}
        >
          {index}
        </span>
      )}
      {index && <span aria-hidden="true" className="opacity-50">{'//'}</span>}
      {children}
    </Tag>
  );
}
