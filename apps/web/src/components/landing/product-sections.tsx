import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { BrandLink } from './brand-link';
import { ConsoleLink } from './console-link';
import { SectionIntro } from './section-intro';

const modules = [
  { title: 'Live operations', description: 'Cameras, annotated feeds, and real-time telemetry.', href: '/cameras', tag: 'Nodes' },
  { title: 'Spatial configuration', description: 'Draw and edit zones and virtual tripwires on a camera preview.', href: '/cameras', tag: 'Geometry' },
  { title: 'Rule policy', description: 'Configure triggers, thresholds, severities, and cooldowns.', href: '/rules', tag: 'Policies' },
  { title: 'Incident vault', description: 'Filter events, inspect evidence, and export incident records.', href: '/events', tag: 'Evidence' },
  { title: 'Historical analytics', description: 'Review event timelines and activity distributions.', href: '/analytics', tag: 'History' },
  { title: 'System health', description: 'Inspect worker health and pipeline metrics.', href: '/system', tag: 'Diagnostics' },
];

export function ProductExperience() {
  return (
    <section id="console" aria-labelledby="console-heading" className="vg-section border-b border-border bg-background text-foreground">
      <div className="vg-container">
        <SectionIntro
          id="console-heading"
          index="06"
          label="The operator experience"
          description="Start with a local video. Configure a zone and a rule. Follow the resulting event all the way to its evidence."
        >
          One console.<br />The whole picture.
        </SectionIntro>
        <ul className="grid gap-px border border-border-strong bg-border md:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ title, description, href, tag }, index) => (
            <li key={title} className="flex">
              {/* Real console routes: unauthenticated visitors are redirected to sign-in. */}
              <Link
                href={href}
                className="group flex w-full flex-col bg-surface p-6 transition-colors duration-micro ease-standard hover:bg-muted focus-visible:[outline-offset:-4px] lg:p-8"
              >
                <span className="mb-6 flex items-center justify-between gap-4">
                  <span className="vg-telemetry text-muted-foreground">{String(index + 1).padStart(2, '0')} · {tag.toUpperCase()}</span>
                  <ArrowUpRight
                    className="h-4 w-4 text-muted-foreground transition-transform duration-micro ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </span>
                <h3 className="font-display text-title font-bold uppercase tracking-[-0.01em] [font-stretch:92%]">{title}</h3>
                <p className="mt-3 text-body text-muted-foreground">{description}</p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="vg-telemetry mt-5 flex gap-3 text-muted-foreground">
          <span aria-hidden="true">↳</span>
          <span>CONSOLE MODULES REQUIRE SIGN-IN. LOCAL VIDEO DEMOS NEED NO PHYSICAL CCTV HARDWARE.</span>
        </p>
      </div>
    </section>
  );
}

const controls = [
  ['HttpOnly authentication cookies', 'Session credentials stay outside client-side JavaScript.'],
  ['Resource ownership checks', 'Camera resources and evidence are scoped to their owner.'],
  ['Camera-bound stream tickets', 'Short-lived credentials authorize a specific camera stream.'],
  ['Protected media and credentials', 'Encrypted RTSP credentials, upload validation, and evidence path checks.'],
];

const toolchain = [
  ['Vision', 'YOLO / ONNX Runtime / ByteTrack / OpenCV'],
  ['Backend', 'FastAPI / SQLAlchemy / PostgreSQL / Alembic'],
  ['Realtime', 'Redis / WebSockets / MJPEG'],
  ['Frontend', 'Next.js / React / TypeScript / Tailwind'],
  ['Deployment', 'Docker / Docker Compose'],
];

export function SecurityAndStack() {
  return (
    <section aria-labelledby="security-heading" className="vg-section-dense border-b border-border bg-surface text-foreground">
      <div className="vg-container">
        <SectionIntro
          id="security-heading"
          index="07"
          label="Security / by design"
          description="Camera infrastructure is treated as security-sensitive from the API boundary to the evidence file."
        >
          Cameras are<br />sensitive infrastructure.
        </SectionIntro>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="vg-label mb-4 text-foreground">Controls in the API</h3>
            <ul className="border-t border-border-strong">
              {controls.map(([title, copy]) => (
                <li key={title} className="flex gap-4 border-b border-border py-4">
                  <span aria-hidden="true" className="vg-telemetry pt-0.5 text-muted-foreground">↳</span>
                  <div>
                    <h4 className="text-body font-semibold">{title}</h4>
                    <p className="mt-1 text-body-sm text-muted-foreground">{copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="vg-label mb-4 text-foreground">The toolchain</h3>
            <dl className="border-t border-border-strong">
              {toolchain.map(([group, technologies]) => (
                <div key={group} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-b border-border py-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <dt className="vg-label pt-0.5 text-muted-foreground">{group}</dt>
                  <dd className="text-body-sm">{technologies}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-heading" className="surface-optical vg-section-atmos bg-tech-grid border-b border-border">
      <div className="vg-container">
        <TechnicalLabel tone="strong" className="mb-8">From the first frame to the final record.</TechnicalLabel>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="final-heading"
            className="font-display text-display-lg font-extrabold uppercase leading-[0.86] tracking-[-0.045em] [font-stretch:82%]"
          >
            Put video<br />to <span className="text-signal">work.</span>
          </h2>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:min-w-[20rem]">
            <ConsoleLink className="w-full" />
            <p className="vg-telemetry text-center text-muted-foreground">LOCAL VIDEO · WEBCAM · RTSP</p>
            <a
              href="#system"
              className="vg-label group inline-flex min-h-11 items-center justify-center gap-2 text-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              Trace the pipeline
              <ArrowUpRight className="h-4 w-4 transition-transform duration-micro ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const footerLink =
  'vg-label inline-flex min-h-11 items-center gap-1.5 text-muted-foreground transition-colors duration-micro ease-standard hover:text-foreground';

export function LandingFooter() {
  return (
    <footer className="surface-optical">
      <div className="vg-container flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <BrandLink />
          <p className="vg-label text-muted-foreground">Real-time computer vision analytics</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-1">
          <Link href="/dashboard" className={footerLink}>Console</Link>
          <a href="#architecture" className={footerLink}>Architecture</a>
          <a href="https://github.com/sohaib-0897/VigilAi#readme" className={footerLink}>
            Documentation <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="vg-container vg-telemetry py-4 text-muted-foreground">DETECT. TRACK. UNDERSTAND.</p>
      </div>
    </footer>
  );
}
