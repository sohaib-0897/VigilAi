import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The VigilAI wordmark: signal square with the shield, condensed display type. */
export function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="VigilAI home"
      className={cn('inline-flex items-center gap-2.5 font-display text-[1.375rem] font-extrabold tracking-[-0.02em] [font-stretch:88%]', className)}
    >
      <span className="grid h-8 w-8 place-items-center bg-signal text-signal-foreground">
        <ShieldAlert className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
      </span>
      VIGILAI
    </Link>
  );
}
