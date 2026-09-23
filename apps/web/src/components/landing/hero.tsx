import { ArrowDown, ArrowUpRight, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConsoleLink } from './console-link';
import styles from './landing.module.css';

function TrackingSchematic() {
  return (
    <figure className={styles.trackingFigure}>
      <div className={styles.figureToolbar}>
        <span><Crosshair size={15} aria-hidden="true" /> SPATIAL ANALYSIS</span>
        <span className={styles.figureTag}>SCHEMATIC</span>
      </div>
      <svg viewBox="0 0 560 390" role="img" aria-labelledby="tracking-title tracking-description" className={styles.trackingSvg}>
        <title id="tracking-title">From persistent tracks to spatial events</title>
        <desc id="tracking-description">Illustrative person geometry, a bounded track trajectory, a virtual crossing line and a polygon zone. This is a diagram, not a live camera feed.</desc>
        <defs>
          <pattern id="schematic-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 H 0 V 28" fill="none" stroke="currentColor" strokeOpacity=".12" />
          </pattern>
          <marker id="trajectory-arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="currentColor" strokeWidth="1.5" /></marker>
        </defs>
        <rect width="560" height="390" fill="url(#schematic-grid)" />
        <path d="M22 52V22H52 M508 22H538V52 M538 338V368H508 M52 368H22V338" fill="none" stroke="currentColor" strokeWidth="3" />
        <polygon points="270,92 490,120 461,329 228,300" className="fill-neo-violet/50 stroke-black" strokeWidth="2" />
        <path d="M270 92L490 120L461 329L228 300Z" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 5" />
        <g className="fill-neo-violet stroke-black" strokeWidth="2">
          <rect x="265" y="87" width="10" height="10" /><rect x="485" y="115" width="10" height="10" />
          <rect x="456" y="324" width="10" height="10" /><rect x="223" y="295" width="10" height="10" />
        </g>
        <rect x="333" y="304" width="104" height="28" fill="black" /><text x="345" y="323" fill="white" fontSize="12">ZONE / ENTRY</text>
        <path d="M58 277L501 210" className="stroke-neo-red" strokeWidth="4" />
        <rect x="52" y="220" width="119" height="25" className="fill-neo-red stroke-black" strokeWidth="2" />
        <text x="62" y="237" fontSize="11" fontWeight="700">VIRTUAL LINE</text>
        <path d="M94 345L126 323L149 287L177 265L220 252L274 239L301 222" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 5" markerEnd="url(#trajectory-arrow)" />
        {[ [94,345], [126,323], [149,287], [177,265], [220,252] ].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="4" fill="black" />)}
        <rect x="252" y="76" width="102" height="174" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M252 96V76H272 M334 76H354V96 M354 230V250H334 M272 250H252V230" fill="none" stroke="currentColor" strokeWidth="5" />
        <rect x="252" y="48" width="126" height="28" className="fill-neo-yellow stroke-black" strokeWidth="2" />
        <text x="262" y="67" fontSize="12" fontWeight="700">PERSON / TRACK</text>
        <circle cx="303" cy="114" r="16" className="fill-neo-cream stroke-black" strokeWidth="2" />
        <path d="M281 141L267 183L280 189L287 162V199L278 235H293L304 204L313 235H329L319 196V162L327 186L340 181L325 141Z" className="fill-neo-cream stroke-black" strokeWidth="2" />
        <circle cx="303" cy="223" r="5" className="fill-neo-red stroke-black" strokeWidth="2" />
        <path d="M369 171H415V78H465" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="429" y="49" fontSize="10">IDENTITY</text><text x="429" y="64" fontSize="10">PERSISTS</text>
        <text x="39" y="47" fontSize="10">x, y ∈ [0, 1]</text>
        <text x="358" y="362" fontSize="10">NORMALIZED GEOMETRY</text>
      </svg>
      <div className={styles.figureFlow}><span>TRACK</span><span aria-hidden="true">→</span><span>CROSS</span><span aria-hidden="true">→</span><span className="bg-neo-green">EVENT</span></div>
      <figcaption>ILLUSTRATIVE GEOMETRY · NO LIVE CAMERA DATA</figcaption>
      <div className={styles.figureSticker} aria-hidden="true">EVERY EVENT<br />HAS A HISTORY.<ArrowUpRight size={23} /></div>
    </figure>
  );
}

export function Hero() {
  return (
    <section className={`${styles.hero} bg-tech-grid`} aria-labelledby="hero-heading">
      <div className={styles.container}>
        <div className={styles.heroTopline}><p className={styles.eyebrow}>REAL-TIME COMPUTER VISION ANALYTICS</p><span className={styles.technicalLabel}>VISION → DECISION</span></div>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <h1 id="hero-heading">VIGIL<span>AI</span><span className={styles.wordmarkDot} aria-hidden="true">.</span></h1>
            <h2>VIDEO IN.<br /><span className={styles.headlineHighlight}>EVENTS OUT.</span></h2>
            <p>Track objects. Define space. Detect what matters. Turn live or recorded video into persistent identities, spatial analytics, configurable alerts, and evidence you can investigate.</p>
            <div className={styles.heroActions}><ConsoleLink /><Button asChild variant="outline" size="lg"><a href="#system">Explore the system<ArrowDown size={17} className="ml-2" aria-hidden="true" /></a></Button></div>
            <div className={styles.heroSources}><span aria-hidden="true">↳</span> LOCAL VIDEO / WEBCAM / RTSP</div>
          </div>
          <TrackingSchematic />
        </div>
        <div className={styles.heroBottom}><span className={styles.technicalLabel}>THE FULL PATH. FRAME TO EVIDENCE.</span><div className={styles.badgeRow}>{['YOLO', 'ONNX', 'ByteTrack', 'FastAPI', 'Next.js', 'PostgreSQL'].map(label => <Badge key={label} variant="outline">{label}</Badge>)}</div></div>
      </div>
    </section>
  );
}
