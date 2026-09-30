import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { BrandLink } from '@/components/landing/brand-link';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { cn } from '@/lib/utils';

// Every line here is backed by the code: the worker pipeline (worker/pipeline.py,
// camera_manager.py), the rule/event engine, and the auth route (api/v1/auth.py,
// core/security.py). Keep it that way if either side changes.
const capabilities = [
  ['01', 'Detect + track', 'YOLO detection and ByteTrack IDs in a dedicated CV worker.'],
  ['02', 'Zones + lines', 'Occupancy, dwell and directional crossings per track.'],
  ['03', 'Events + evidence', 'Deduplicated rule events with annotated snapshots.'],
];

const sessionFacts = ['Session held in an HttpOnly cookie', 'Passwords stored as bcrypt hashes'];

type AuthShellProps = {
  /** Mono label above the heading, e.g. "Sign in". */
  label: string;
  title: React.ReactNode;
  description: string;
  children: React.ReactNode;
  /** Switch link to the sibling auth page. */
  footer: React.ReactNode;
};

/**
 * Split layout for the public auth pages: an optical product panel beside a
 * paper form panel from `lg` up, a single column with the brand on top below.
 */
export function AuthShell({ label, title, description, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-background text-foreground lg:grid-rows-none lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="surface-optical relative flex flex-col border-b border-border bg-tech-grid px-gutter py-6 lg:border-b-0 lg:border-r lg:py-10">
        <BrandLink className="self-start" />

        <div className="hidden flex-1 flex-col justify-center gap-10 py-12 lg:flex">
          <div className="space-y-5">
            <TechnicalLabel index="00" tone="signal">Vision → decision</TechnicalLabel>
            <p className="font-display text-display-md font-extrabold uppercase leading-[.9] [font-stretch:85%]">
              Video in.
              <br />
              <span className="text-signal">Events out.</span>
            </p>
            <p className="max-w-[34ch] text-body-lg text-muted-foreground">
              Real-time computer vision analytics for local video, webcams and RTSP cameras.
            </p>
          </div>

          <ol className="max-w-md border-t border-border">
            {capabilities.map(([index, name, detail]) => (
              <li key={index} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-border py-4">
                <span className="vg-telemetry text-signal">{index}</span>
                <div>
                  <p className="vg-label text-foreground">{name}</p>
                  <p className="mt-1.5 text-body-sm text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <ul className="vg-telemetry hidden flex-wrap gap-x-6 gap-y-1 text-muted-foreground lg:flex">
          {sessionFacts.map(fact => (
            <li key={fact}>↳ {fact.toUpperCase()}</li>
          ))}
        </ul>
      </aside>

      <main id="main-content" className="flex items-start justify-center px-gutter py-10 sm:py-16 lg:items-center">
        <div className="w-full max-w-[26rem]">
          <header className="border-b border-border-strong pb-6">
            <TechnicalLabel tone="strong">{label}</TechnicalLabel>
            <h1 className="mt-4 font-display text-heading font-extrabold uppercase leading-[.95] [font-stretch:85%]">{title}</h1>
            <p className="mt-3 text-body text-muted-foreground">{description}</p>
          </header>
          {children}
          <div className="mt-8 border-t border-border pt-5 text-body-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  );
}

/** Announced error region for a failed submit. Renders nothing without a message. */
export function AuthAlert({ message, className }: { message: string; className?: string }) {
  return (
    <div role="alert" className={cn(message && ['flex items-start gap-3 bg-danger px-4 py-3 text-danger-foreground', className])}>
      {message && (
        <>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
          <p className="text-body-sm font-medium">{message}</p>
        </>
      )}
    </div>
  );
}

/** Inline link to the sibling auth page, sized as a 44px target. */
export const authSwitchLink =
  'inline-flex min-h-11 items-center font-semibold text-foreground underline decoration-1 underline-offset-4 transition-[text-decoration-thickness] duration-micro ease-standard hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
