import { ArrowDown, ArrowUpRight, Check, HardHat, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from './section-heading';
import { percent, ppeBenchmark, ppeDataset, ppeEvaluation, throughputRatio } from './engineering-data';
import styles from './landing.module.css';

export function EngineeringNumbers() {
  const stats = [
    [ppeDataset.summary.total_images.toLocaleString('en-US'), 'PPE DATASET IMAGES', '#ppe'],
    [ppeDataset.summary.total_annotated_instances.toLocaleString('en-US'), 'LABELED INSTANCES', '#ppe'],
    [`${throughputRatio}×`, 'MEASURED CPU THROUGHPUT GAIN', '#performance'],
    [String(Object.keys(ppeEvaluation.per_class_metrics).length).padStart(2, '0'), 'EVALUATED PPE CLASSES', '#ppe'],
  ];
  return (
    <div className={styles.statsStrip} aria-label="Measured engineering in numbers">
      <div className={styles.statsInner}>{stats.map(([value, label, href]) => (
        <a key={label} href={href}><strong>{value}</strong><span>{label}<ArrowUpRight size={15} aria-hidden="true" /></span></a>
      ))}</div>
    </div>
  );
}

export function PpeSection() {
  const metrics = [
    ['HELMET AP@50', ppeEvaluation.per_class_metrics.helmet.mAP50],
    ['VEST AP@50', ppeEvaluation.per_class_metrics.vest.mAP50],
    ['PERSON AP@50', ppeEvaluation.per_class_metrics.Person.mAP50],
    ['OVERALL mAP@50', ppeEvaluation.metrics.mAP50],
  ] as const;

  return (
    <section id="ppe" className={`${styles.section} ${styles.ppeSection}`}>
      <div className={styles.container}>
        <SectionHeading index="03" label="Custom model / PPE" description="YOLOv8 fine-tuning meets person-centric logic. Equipment detections become a temporal compliance state tied to a tracked person.">SAFETY HAS<br />A CONTEXT.</SectionHeading>
        <div className={styles.ppeGrid}>
          <div className={styles.ppeCopy}>
            <Badge variant="black">CUSTOM TRAINING → HELD-OUT EVALUATION</Badge>
            <h3>A helmet is an object.<br />Compliance is a relationship.</h3>
            <p>Fine-tuned on the training split of a {ppeDataset.summary.total_images.toLocaleString('en-US')}-image Construction-PPE dataset with {ppeDataset.summary.total_annotated_instances.toLocaleString('en-US')} labeled instances overall. The pipeline associates equipment with each person, smooths observations over time, and applies the requirements of the relevant zone.</p>
            <ul className={styles.featureList}>
              <li><Check aria-hidden="true" />Person-centric equipment association</li>
              <li><Check aria-hidden="true" />Temporal confirmation and recovery</li>
              <li><Check aria-hidden="true" />Zone-aware rules and evidence capture</li>
            </ul>
            <a href="/engineering/ppe_dataset_report.json" className={styles.sourceLink}>Inspect dataset report <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
          <figure className={styles.ppeDiagram}>
            <figcaption className={styles.figureToolbar}><span><HardHat size={18} aria-hidden="true" /> COMPLIANCE LOGIC</span><span className={styles.figureTag}>ILLUSTRATIVE</span></figcaption>
            <div className={styles.ppeDiagramBody}>
              <div className={styles.personTrack}>PERSON TRACK <span>+ ZONE POLICY</span></div>
              <ArrowDown className={styles.flowArrow} aria-hidden="true" />
              <div className={styles.equipment}><span>HELMET <Check aria-label="observed" /></span><span>VEST <Check aria-label="observed" /></span><span>GLOVES <TriangleAlert aria-label="missing" /></span></div>
              <ArrowDown className={styles.flowArrow} aria-hidden="true" />
              <div className={styles.temporalBox}><span>TEMPORAL CONFIRMATION</span><div aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><small>Repeated observations → confirmed state</small></div>
              <ArrowDown className={styles.flowArrow} aria-hidden="true" />
              <div className={styles.violationBox}>PPE VIOLATION <span>→ EVIDENCE</span></div>
            </div>
          </figure>
        </div>
        <div className={styles.metricHeader}><span>HELD-OUT PPE TEST SET</span><span>512 PX INPUT / 20 SEP 2026</span></div>
        <dl className={styles.modelMetrics}>{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{percent(value)}</dd></div>)}</dl>
        <div className={styles.metricContext}>
          <p>Overall mAP@50–95: <strong>{percent(ppeEvaluation.metrics.mAP50_95)}</strong> across all {Object.keys(ppeEvaluation.per_class_metrics).length} classes. Missing-equipment classes remain weaker; no_boots AP@50 is {percent(ppeEvaluation.per_class_metrics.no_boots.mAP50)}. This is an evaluated project model, not a certified safety system.</p>
          <a href="/engineering/ppe_test_results.json" className={styles.sourceLink}>Full evaluation JSON <ArrowUpRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}

export function Performance() {
  const { pytorch, onnxruntime } = ppeBenchmark.backends;
  return (
    <section id="performance" className={styles.section}>
      <div className={styles.container}>
        <SectionHeading index="04" label="Measured performance" description="Same PPE model. Same CPU. Two inference backends. Recorded measurements, with the conditions attached.">BENCHMARKS.<br />NOT BUZZWORDS.</SectionHeading>
        <div className={styles.performanceGrid}>
          <div className={styles.speedupPanel}><span className={styles.technicalLabel}>ONNX RUNTIME / PYTORCH</span><strong>{throughputRatio}<span>×</span></strong><h3>MEASURED CPU<br />INFERENCE THROUGHPUT</h3><span className={styles.speedupStamp}>CPU ONLY <ArrowUpRight size={24} aria-hidden="true" /></span></div>
          <div className={styles.benchmarkPanel}>
            <div className={styles.benchmarkRow}><div><h3>PYTORCH</h3><span>CPU / FP32</span></div><strong>{pytorch.fps.toFixed(2)} <small>FPS</small></strong><div className={styles.benchmarkBar} aria-hidden="true"><span style={{ width: `${pytorch.fps / onnxruntime.fps * 100}%` }} /></div><p>{pytorch.mean_latency_ms.toFixed(2)} ms mean <span>{pytorch.p95_latency_ms.toFixed(2)} ms p95</span></p></div>
            <div className={`${styles.benchmarkRow} ${styles.onnxRow}`}><div><h3>ONNX RUNTIME</h3><span>CPUExecutionProvider</span></div><strong>{onnxruntime.fps.toFixed(2)} <small>FPS</small></strong><div className={styles.benchmarkBar} aria-hidden="true"><span style={{ width: '100%' }} /></div><p>{onnxruntime.mean_latency_ms.toFixed(2)} ms mean <span>{onnxruntime.p95_latency_ms.toFixed(2)} ms p95</span></p></div>
          </div>
        </div>
        <div className={styles.benchmarkContext}><p><strong>Intel Core i5-13420H · CPU benchmark</strong><br />512 × 512 input · {ppeBenchmark.configuration.warmup_runs} warmup + {ppeBenchmark.configuration.measured_runs} measured runs · 20 Sep 2026<br />Isolated inference throughput; full video pipeline performance varies. GPU and TensorRT results: NOT_MEASURED.</p><a className={styles.sourceLink} href="/engineering/ppe_inference_benchmarks.json">Inspect benchmark JSON <ArrowUpRight size={16} aria-hidden="true" /></a></div>
      </div>
    </section>
  );
}
