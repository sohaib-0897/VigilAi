import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { ConsoleLink } from './console-link';
import { DemoLink } from './demo-link';
import { HeroVisual } from './hero/hero-visual';

const stack = ['YOLO', 'ONNX Runtime', 'ByteTrack', 'FastAPI', 'Next.js', 'PostgreSQL'];
const flow = ['Detect', 'Track', 'Cross', 'Event', 'Evidence'];

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="surface-optical bg-tech-grid relative border-b border-border">
      <div className="vg-container flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-border py-4">
          <TechnicalLabel index="00" tone="signal" className="text-foreground">Real-time computer vision analytics</TechnicalLabel>
          <span className="vg-telemetry hidden text-muted-foreground md:inline">VISION → DECISION</span>
        </div>

        <div className="grid items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-20">
          <div className="flex flex-col">
            <h1
              id="hero-heading"
              className="-ml-[0.04em] font-display text-[clamp(4.5rem,22vw,8rem)] font-extrabold leading-[0.86] tracking-[-0.045em] [font-stretch:82%] lg:text-[clamp(6rem,10.4vw,9.75rem)]"
            >
              VIGIL<span className="text-signal-ink">AI</span>
            </h1>
            <h2 className="mt-6 font-display text-heading font-bold uppercase tracking-[-0.02em] [font-stretch:92%]">
              <span className="text-muted-foreground">Video in.</span> Events out.
            </h2>
            <p className="mt-5 max-w-[34rem] text-body-lg text-muted-foreground">
              Track objects. Define space. Detect what matters. Turn live or recorded video into persistent identities,
              spatial analytics, configurable alerts, and evidence you can investigate.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start [&>*]:w-full sm:[&>*]:w-auto [&_button]:w-full sm:[&_button]:w-auto">
              <ConsoleLink />
              <DemoLink />
              <Button asChild variant="outline" size="lg">
                <a href="#system">Explore the system<ArrowDown className="h-4 w-4" aria-hidden="true" /></a>
              </Button>
            </div>
            <p className="vg-telemetry mt-6 text-muted-foreground">SOURCES ── LOCAL VIDEO / WEBCAM / RTSP</p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <HeroVisual />
            <ol aria-label="Event path" className="vg-label flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              {flow.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true" className="opacity-50">→</span>}
                  <span className={index === 3 ? 'bg-signal px-1.5 text-signal-foreground' : undefined}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border py-5 md:flex-row md:items-center md:justify-between">
          <TechnicalLabel>The full path. Frame to evidence.</TechnicalLabel>
          <ul aria-label="Technology stack" className="flex flex-wrap gap-2">
            {stack.map(label => <li key={label}><Badge variant="outline">{label}</Badge></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
