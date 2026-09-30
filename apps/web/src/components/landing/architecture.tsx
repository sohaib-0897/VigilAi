import { ArrowDown, Database, FolderLock, Radio } from 'lucide-react';
import { ViewportFrame } from '@/components/primitives/viewport-frame';
import { cn } from '@/lib/utils';
import { SectionIntro } from './section-intro';

const sources = ['Local video', 'RTSP', 'Webcam'];

const workerModules = [
  'Decode + bounded buffer',
  'YOLO / ONNX',
  'ByteTrack',
  'Geometry + PPE',
  'Rules + event state',
  'Evidence capture',
];

const branches = [
  { icon: Database, name: 'PostgreSQL', detail: 'Events · Rules · Configuration', inbound: 'Write events ↓', outbound: 'Read / write ↕' },
  { icon: FolderLock, name: 'Evidence storage', detail: 'Annotated snapshots', inbound: 'Capture ↓', outbound: 'Authorized read ↓' },
  { icon: Radio, name: 'Redis', detail: 'Frames · Status · Events', inbound: 'Publish ↓', outbound: 'Subscribe ↓' },
];

const principles = [
  ['Detection ≠ tracking', 'Persistent identities power unique counts and temporal analytics.'],
  ['Freshness > backlog', 'Bounded buffers drop stale frames instead of accumulating latency.'],
  ['Events require state', 'Cooldowns and lifecycle management prevent repeated alert spam.'],
  ['Geometry scales', 'Zones and lines use normalized coordinates, independent of resolution.'],
  ['Inference ≠ HTTP', 'Long-running CV execution lives outside the API process.'],
];

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-2 text-muted-foreground">
      <ArrowDown className="h-4 w-4" aria-hidden="true" />
      {label && <span className="vg-telemetry">{label}</span>}
    </div>
  );
}

function Node({ name, detail, className }: { name: string; detail: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1 border border-border-strong bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4', className)}>
      <span className="font-display text-title font-bold uppercase tracking-[-0.01em] [font-stretch:92%]">{name}</span>
      <span className="vg-telemetry text-muted-foreground">{detail}</span>
    </div>
  );
}

export function Architecture() {
  return (
    <section id="architecture" aria-labelledby="architecture-heading" className="surface-optical vg-section border-b border-border">
      <div className="vg-container">
        <SectionIntro
          id="architecture-heading"
          index="05"
          label="Runtime architecture"
          description="Inference, delivery, and persistence have distinct responsibilities. Camera state stays scoped to each camera pipeline."
        >
          Separate processes.<br />Connected system.
        </SectionIntro>

        <ViewportFrame
          as="figure"
          aria-label="VigilAI runtime topology: video sources feed a dedicated CV worker, which writes to PostgreSQL and evidence storage and publishes through Redis to the FastAPI service and the Next.js console."
          label="VigilAI / runtime topology"
          meta={<span className="vg-telemetry text-muted-foreground">DATA FLOW ↓</span>}
          brackets={false}
        >
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 border border-border-strong bg-background px-4 py-3">
              <span className="vg-label mr-2 text-muted-foreground">Sources</span>
              {sources.map(source => (
                <span key={source} className="vg-label border border-border px-2 py-1 text-foreground">{source}</span>
              ))}
            </div>
            <Connector />

            <div className="border border-border-strong bg-background">
              <div className="flex flex-col gap-1 border-b border-border-strong px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-2.5 font-display text-title font-bold uppercase tracking-[-0.01em] [font-stretch:92%]">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 bg-signal" />
                  Dedicated CV worker
                </span>
                <span className="vg-telemetry text-muted-foreground">PER-CAMERA PIPELINES</span>
              </div>
              <ol className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
                {workerModules.map((module, index) => (
                  <li key={module} className="flex flex-col gap-2 bg-background p-4">
                    <span className="vg-telemetry text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-body-sm font-semibold">{module}</span>
                  </li>
                ))}
              </ol>
            </div>

            <ul className="my-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {branches.map(({ icon: Icon, name, detail, inbound, outbound }) => (
                <li key={name} className="flex flex-col items-center border border-border-strong bg-background px-4 py-4 text-center">
                  <span className="vg-telemetry text-muted-foreground">{inbound.toUpperCase()}</span>
                  <Icon className="my-3 h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
                  <span className="font-display text-title font-bold uppercase tracking-[-0.01em] [font-stretch:92%]">{name}</span>
                  <span className="mb-3 mt-1 flex-1 text-body-sm text-muted-foreground">{detail}</span>
                  <span className="vg-telemetry text-muted-foreground">{outbound.toUpperCase()}</span>
                </li>
              ))}
            </ul>

            <Node name="FastAPI" detail="AUTHORIZATION / REST / WEBSOCKETS / MJPEG" />
            <p className="vg-telemetry py-3 text-center text-muted-foreground">
              REQUESTS ↑ <span aria-hidden="true" className="px-2">/</span> STREAMS + RESPONSES ↓
            </p>
            <Node name="Next.js console" detail="OPERATIONS → CONFIGURATION → INVESTIGATION" />
          </div>
        </ViewportFrame>

        <div className="mt-16 grid gap-10 lg:mt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <h3 className="font-display text-heading font-extrabold uppercase leading-[0.95] tracking-[-0.03em] [font-stretch:85%]">
            Built for real-time,<br /><span className="text-signal">not demo-time.</span>
          </h3>
          <dl className="border-t border-border">
            {principles.map(([title, copy], index) => (
              <div key={title} className="grid gap-2 border-b border-border py-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-6">
                <dt className="vg-label flex gap-3 text-foreground">
                  <span className="tabular text-signal">{String(index + 1).padStart(2, '0')}</span>
                  {title}
                </dt>
                <dd className="text-body-sm text-muted-foreground">{copy}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
