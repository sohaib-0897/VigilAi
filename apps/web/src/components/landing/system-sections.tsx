import { Fingerprint, ScanLine, Workflow, HardHat, Radio, FileSearch } from 'lucide-react';
import { SectionIntro } from './section-intro';
import { SignalChain, type SignalStage } from './signal-chain';

const stages: readonly SignalStage[] = [
  { title: 'Ingest', label: 'RTSP · Webcam · Video', description: 'OpenCV decode. Bounded frame buffers. Fresh frames first.' },
  { title: 'Perceive', label: 'YOLO · ONNX Runtime', description: 'Typed detections: class, confidence, and bounding box.' },
  { title: 'Track', label: 'ByteTrack', description: 'Associate detections across frames. Keep identity and trajectory.' },
  { title: 'Understand', label: 'Zones · Lines · Dwell', description: 'Evaluate spatial transitions, direction, and occupancy.' },
  { title: 'Decide', label: 'Stateful rules', description: 'Apply policy, thresholds, cooldowns, and deduplication.' },
  { title: 'Record', label: 'Events · Evidence', description: 'Persist the incident. Capture the snapshot. Make it reviewable.' },
];

export function Pipeline() {
  return (
    <section id="system" aria-labelledby="system-heading" className="vg-section border-b border-border bg-background text-foreground">
      <div className="vg-container">
        <SectionIntro
          id="system-heading"
          index="01"
          label="The signal chain"
          description="A prediction is only the beginning. VigilAI carries each frame through identity, geometry, policy, and a durable event record."
        >
          From pixels<br />to proof.
        </SectionIntro>
        <SignalChain stages={stages} />
        <p className="vg-telemetry mt-5 flex gap-3 text-muted-foreground">
          <span aria-hidden="true">↳</span>
          <span>RUNS IN A DEDICATED CV WORKER. THE API KEEPS SERVING REQUESTS.</span>
        </p>
      </div>
    </section>
  );
}

const capabilities = [
  { icon: Fingerprint, title: 'Multi-object tracking', label: 'Identity / Time', copy: 'Persistent ByteTrack IDs connect detections across frames, powering unique counts and bounded trajectory history.' },
  { icon: ScanLine, title: 'Spatial intelligence', label: 'Position / Context', copy: 'Draw polygon zones and virtual lines. Detect entry, exit, and direction-aware crossings in normalized coordinates.' },
  { icon: Workflow, title: 'Stateful event engine', label: 'Policy / Lifecycle', copy: 'Dwell and occupancy thresholds become events with cooldowns, deduplication, and resolution semantics.' },
  { icon: HardHat, title: 'PPE safety analytics', label: 'Person / Equipment', copy: 'Custom PPE detections are associated with people, smoothed over time, and evaluated against zone-aware rules.' },
  { icon: Radio, title: 'Real-time operations', label: 'Workers / Telemetry', copy: 'Dedicated camera pipelines publish frames, status, and events through Redis to the API and WebSocket clients.' },
  { icon: FileSearch, title: 'Forensic evidence', label: 'Incident / Record', copy: 'Annotated snapshots preserve event context. Filter historical incidents, review evidence, and export event records.' },
];

export function Capabilities() {
  return (
    <section id="capabilities" aria-labelledby="capabilities-heading" className="vg-section border-b border-border bg-surface text-foreground">
      <div className="vg-container">
        <SectionIntro
          id="capabilities-heading"
          index="02"
          label="Operational capabilities"
          description="Computer vision, temporal logic, and a connected operator console. Each part has a job beyond drawing a box."
        >
          More than<br />bounding boxes.
        </SectionIntro>
        <ul className="grid gap-px border border-border-strong bg-border md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, label, copy }, index) => (
            <li key={title} className="flex flex-col bg-surface p-6 lg:p-8">
              <div className="mb-8 flex items-start justify-between gap-4">
                <span className="inline-flex h-11 w-11 items-center justify-center border border-border-strong">
                  <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="vg-telemetry text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="font-display text-title font-bold uppercase tracking-[-0.01em] [font-stretch:92%]">{title}</h3>
              <p className="mt-3 flex-1 text-body text-muted-foreground">{copy}</p>
              <p className="vg-label mt-6 border-t border-border pt-4 text-muted-foreground">{label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
