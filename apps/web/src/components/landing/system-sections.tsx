import { ArrowDownRight, ArrowRight, Fingerprint, ScanLine, Workflow, HardHat, Radio, FileSearch } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { SectionHeading } from './section-heading';
import styles from './landing.module.css';

const stages = [
  ['INGEST', 'RTSP · Webcam · Video', 'OpenCV decode. Bounded frame buffers. Fresh frames first.'],
  ['PERCEIVE', 'YOLO · ONNX Runtime', 'Typed detections: class, confidence, and bounding box.'],
  ['TRACK', 'ByteTrack', 'Associate detections across frames. Keep identity and trajectory.'],
  ['UNDERSTAND', 'Zones · Lines · Dwell', 'Evaluate spatial transitions, direction, and occupancy.'],
  ['DECIDE', 'Stateful rules', 'Apply policy, thresholds, cooldowns, and deduplication.'],
  ['RECORD', 'Events · Evidence', 'Persist the incident. Capture the snapshot. Make it reviewable.'],
];

export function Pipeline() {
  return (
    <section id="system" className={`${styles.section} ${styles.pipelineSection}`}>
      <div className={styles.container}>
        <SectionHeading index="01" label="The signal chain" description="A prediction is only the beginning. VigilAI carries each frame through identity, geometry, policy, and a durable event record.">FROM PIXELS<br />TO PROOF.</SectionHeading>
        <ol className={styles.pipeline}>
          {stages.map(([title, label, description], index) => (
            <li key={title}>
              <div className={styles.pipelineTop}><span>0{index + 1}</span><ArrowRight size={24} aria-hidden="true" /></div>
              <h3>{title}</h3><p className={styles.pipelineLabel}>{label}</p><p>{description}</p>
            </li>
          ))}
        </ol>
        <p className={styles.pipelineFootnote}><span aria-hidden="true">↳</span> RUNS IN A DEDICATED CV WORKER. THE API KEEPS SERVING REQUESTS.</p>
      </div>
    </section>
  );
}

const capabilities = [
  { icon: Fingerprint, title: 'Multi-object tracking', label: 'IDENTITY / TIME', copy: 'Persistent ByteTrack IDs connect detections across frames, powering unique counts and bounded trajectory history.' },
  { icon: ScanLine, title: 'Spatial intelligence', label: 'POSITION / CONTEXT', copy: 'Draw polygon zones and virtual lines. Detect entry, exit, and direction-aware crossings in normalized coordinates.' },
  { icon: Workflow, title: 'Stateful event engine', label: 'POLICY / LIFECYCLE', copy: 'Dwell and occupancy thresholds become events with cooldowns, deduplication, and resolution semantics.' },
  { icon: HardHat, title: 'PPE safety analytics', label: 'PERSON / EQUIPMENT', copy: 'Custom PPE detections are associated with people, smoothed over time, and evaluated against zone-aware rules.' },
  { icon: Radio, title: 'Real-time operations', label: 'WORKERS / TELEMETRY', copy: 'Dedicated camera pipelines publish frames, status, and events through Redis to the API and WebSocket clients.' },
  { icon: FileSearch, title: 'Forensic evidence', label: 'INCIDENT / RECORD', copy: 'Annotated snapshots preserve event context. Filter historical incidents, review evidence, and export event records.' },
];

export function Capabilities() {
  return (
    <section id="capabilities" className={styles.section}>
      <div className={styles.container}>
        <SectionHeading index="02" label="Operational capabilities" description="Computer vision, temporal logic, and a connected operator console. Each part has a job beyond drawing a box.">MORE THAN<br />BOUNDING BOXES.<ArrowDownRight aria-hidden="true" /></SectionHeading>
        <div className={styles.capabilityGrid}>
          {capabilities.map(({ icon: Icon, title, label, copy }, index) => (
            <Card key={title} className={styles.capabilityCard}>
              <div className={styles.capabilityTop}><Icon size={29} strokeWidth={1.8} aria-hidden="true" /><span>0{index + 1}</span></div>
              <h3>{title}</h3><p>{copy}</p><div className={styles.cardLabel}>{label}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
