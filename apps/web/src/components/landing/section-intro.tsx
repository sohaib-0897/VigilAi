import type { ReactNode } from 'react';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { cn } from '@/lib/utils';

/**
 * Token-based landing section header: indexed technical label, condensed display
 * heading, and an optional description column. Surface-agnostic (paper or optical).
 * Pass `id` and reference it from the section's `aria-labelledby`.
 */
export function SectionIntro({ id, index, label, description, children, className }: {
  id: string;
  index: string;
  label: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-10 grid gap-6 border-b border-border pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:items-end md:gap-12 lg:mb-14',
        className,
      )}
    >
      <div>
        <TechnicalLabel index={index} tone="signal" className="mb-5 text-foreground">{label}</TechnicalLabel>
        <h2
          id={id}
          className="font-display text-display-md font-extrabold uppercase leading-[0.9] tracking-[-0.035em] [font-stretch:85%]"
        >
          {children}
        </h2>
      </div>
      {description && <p className="max-w-measure text-body text-muted-foreground md:pb-1">{description}</p>}
    </header>
  );
}
