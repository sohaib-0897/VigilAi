import Link from 'next/link';
import { ArrowUpRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ConsoleLink } from './console-link';
import { SectionHeading } from './section-heading';
import styles from './landing.module.css';

const modules = [
  ['LIVE OPERATIONS', 'Cameras, annotated feeds, and real-time telemetry.', '/cameras', 'NODES'],
  ['SPATIAL CONFIGURATION', 'Draw and edit zones and virtual tripwires on a camera preview.', '/cameras', 'GEOMETRY'],
  ['RULE POLICY', 'Configure triggers, thresholds, severities, and cooldowns.', '/rules', 'POLICIES'],
  ['INCIDENT VAULT', 'Filter events, inspect evidence, and export incident records.', '/events', 'EVIDENCE'],
  ['HISTORICAL ANALYTICS', 'Review event timelines and activity distributions.', '/analytics', 'HISTORY'],
  ['SYSTEM HEALTH', 'Inspect worker health and pipeline metrics.', '/system', 'DIAGNOSTICS'],
];

export function ProductExperience() {
  return (
    <section className={styles.section} id="console">
      <div className={styles.container}>
        <SectionHeading index="06" label="The operator experience" description="Start with a local video. Configure a zone and a rule. Follow the resulting event all the way to its evidence.">ONE CONSOLE.<br />THE WHOLE PICTURE.</SectionHeading>
        <div className={styles.productModules}>{modules.map(([title, description, href, tag], index) => <Link href={href} key={title} className={styles.productModule}><span className={styles.moduleNumber}>0{index + 1}</span><div><span className={styles.moduleTag}>{tag}</span><h3>{title}</h3><p>{description}</p></div><ArrowUpRight aria-hidden="true" /></Link>)}</div>
        <p className={styles.moduleNote}>CONSOLE MODULES REQUIRE SIGN-IN. LOCAL VIDEO DEMOS NEED NO PHYSICAL CCTV HARDWARE.</p>
      </div>
    </section>
  );
}

export function SecurityAndStack() {
  return (
    <section className={styles.securitySection} aria-labelledby="security-heading">
      <div className={styles.container}>
        <div className={styles.securityGrid}>
          <div><ShieldCheck size={38} strokeWidth={1.7} aria-hidden="true" /><p className={styles.eyebrow}>SECURITY / BY DESIGN</p><h2 id="security-heading">CAMERAS ARE<br />SENSITIVE<br />INFRASTRUCTURE.</h2></div>
          <ul>{[
            ['HttpOnly authentication cookies', 'Session credentials stay outside client-side JavaScript.'],
            ['Resource ownership checks', 'Camera resources and evidence are scoped to their owner.'],
            ['Camera-bound stream tickets', 'Short-lived credentials authorize a specific camera stream.'],
            ['Protected media and credentials', 'Encrypted RTSP credentials, upload validation, and evidence path checks.'],
          ].map(([title, copy]) => <li key={title}><span aria-hidden="true">↳</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ul>
        </div>
        <div className={styles.stack}><h3>THE TOOLCHAIN</h3><dl>{[
          ['VISION', 'YOLO / ONNX Runtime / ByteTrack / OpenCV'],
          ['BACKEND', 'FastAPI / SQLAlchemy / PostgreSQL / Alembic'],
          ['REALTIME', 'Redis / WebSockets / MJPEG'],
          ['FRONTEND', 'Next.js / React / TypeScript / Tailwind'],
          ['DEPLOYMENT', 'Docker / Docker Compose'],
        ].map(([group, technologies]) => <div key={group}><dt>{group}</dt><dd>{technologies}</dd></div>)}</dl></div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={`${styles.finalCta} bg-tech-dots`} aria-labelledby="final-heading">
      <div className={styles.container}><p className={styles.eyebrow}>FROM THE FIRST FRAME TO THE FINAL RECORD.</p><div><h2 id="final-heading">PUT VIDEO<br />TO <span>WORK.</span></h2><div className={styles.finalActions}><ConsoleLink /><p>LOCAL VIDEO · WEBCAM · RTSP</p><a href="#system">Trace the pipeline <ArrowUpRight size={16} aria-hidden="true" /></a></div></div></div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className={styles.footer}><div className={styles.container}><div><Link href="/" className={styles.brand}><ShieldAlert size={23} aria-hidden="true" /> VIGILAI</Link><p>REAL-TIME COMPUTER VISION ANALYTICS</p></div><nav aria-label="Footer navigation"><Link href="/dashboard">Console</Link><a href="#architecture">Architecture</a><a href="https://github.com/sohaib-0897/VigilAi#readme">Documentation <ArrowUpRight size={13} aria-hidden="true" /></a></nav><span>DETECT. TRACK. UNDERSTAND.</span></div></footer>
  );
}
