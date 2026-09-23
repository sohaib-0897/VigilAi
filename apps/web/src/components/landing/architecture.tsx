import { ArrowDown, ArrowRight, Database, FolderLock, Radio } from 'lucide-react';
import { SectionHeading } from './section-heading';
import styles from './landing.module.css';

const principles = [
  ['DETECTION ≠ TRACKING', 'Persistent identities power unique counts and temporal analytics.'],
  ['FRESHNESS > BACKLOG', 'Bounded buffers drop stale frames instead of accumulating latency.'],
  ['EVENTS REQUIRE STATE', 'Cooldowns and lifecycle management prevent repeated alert spam.'],
  ['GEOMETRY SCALES', 'Zones and lines use normalized coordinates, independent of resolution.'],
  ['INFERENCE ≠ HTTP', 'Long-running CV execution lives outside the API process.'],
];

export function Architecture() {
  return (
    <section id="architecture" className={`${styles.section} ${styles.architectureSection}`}>
      <div className={styles.container}>
        <SectionHeading index="05" label="Runtime architecture" description="Inference, delivery, and persistence have distinct responsibilities. Camera state stays scoped to each camera pipeline.">SEPARATE PROCESSES.<br />CONNECTED SYSTEM.</SectionHeading>
        <figure className={styles.architectureDiagram}>
          <figcaption className={styles.architectureCaption}>VIGILAI / RUNTIME TOPOLOGY <span>DATA FLOW ↓</span></figcaption>
          <div className={styles.sourceNode}>LOCAL VIDEO <span>/</span> RTSP <span>/</span> WEBCAM</div>
          <ArrowDown className={styles.flowArrow} aria-hidden="true" />
          <div className={styles.workerNode}><div className={styles.workerTitle}><strong>DEDICATED CV WORKER</strong><span>PER-CAMERA PIPELINES</span></div><div className={styles.workerModules}>{['Decode + bounded buffer', 'YOLO / ONNX', 'ByteTrack', 'Geometry + PPE', 'Rules + event state', 'Evidence capture'].map((label, index) => <span key={label}><small>0{index + 1}</small>{label}{index < 5 && <ArrowRight size={14} aria-hidden="true" />}</span>)}</div></div>
          <div className={styles.architectureBranches}>
            <div><span className={styles.branchLabel}>WRITE EVENTS ↓</span><Database aria-hidden="true" /><strong>POSTGRESQL</strong><p>Events · Rules · Configuration</p><span className={styles.branchLabel}>READ / WRITE ↕</span></div>
            <div><span className={styles.branchLabel}>CAPTURE ↓</span><FolderLock aria-hidden="true" /><strong>EVIDENCE STORAGE</strong><p>Annotated snapshots</p><span className={styles.branchLabel}>AUTHORIZED READ ↓</span></div>
            <div><span className={styles.branchLabel}>PUBLISH ↓</span><Radio aria-hidden="true" /><strong>REDIS</strong><p>Frames · Status · Events</p><span className={styles.branchLabel}>SUBSCRIBE ↓</span></div>
          </div>
          <div className={styles.apiNode}><strong>FASTAPI</strong><span>AUTHORIZATION / REST / WEBSOCKETS / MJPEG</span></div>
          <div className={styles.apiConnection}>REQUESTS ↑ <span aria-hidden="true">/</span> STREAMS + RESPONSES ↓</div>
          <div className={styles.consoleNode}><strong>NEXT.JS CONSOLE</strong><span>OPERATIONS → CONFIGURATION → INVESTIGATION</span></div>
        </figure>
        <div className={styles.principles}><h3>BUILT FOR REAL-TIME,<br /><span>NOT DEMO-TIME.</span></h3><dl>{principles.map(([title, copy]) => <div key={title}><dt>{title}</dt><dd>{copy}</dd></div>)}</dl></div>
      </div>
    </section>
  );
}
