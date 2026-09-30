import { Fragment, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, Check, HardHat, TriangleAlert } from 'lucide-react';
import { MetricDisplay } from '@/components/primitives/metric-display';
import { TechnicalLabel } from '@/components/primitives/technical-label';
import { ViewportFrame } from '@/components/primitives/viewport-frame';
import { cn } from '@/lib/utils';
import { SectionIntro } from './section-intro';
import { MeasuredBar } from './measured-bar';
import { percent, ppeBenchmark, ppeDataset, ppeEvaluation, throughputRatio } from './engineering-data';

/** Link to a published artifact: mono label voice, 44px target, underline affordance. */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="vg-label group inline-flex min-h-11 shrink-0 items-center gap-2 text-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
    >
      {children}
      <ArrowUpRight className="h-4 w-4 transition-transform duration-micro ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  );
}

/** Wraps `_`-separated artifact names at their separators on narrow columns. */
function breakable(name: string) {
  return name.split('_').map((part, i) => <Fragment key={part}>{i > 0 && <>_<wbr /></>}{part}</Fragment>);
}

export function EngineeringNumbers() {
  const stats = [
    { value: ppeDataset.summary.total_images.toLocaleString('en-US'), label: 'PPE dataset images', source: 'ppe_dataset_report.json', href: '#ppe' },
    { value: ppeDataset.summary.total_annotated_instances.toLocaleString('en-US'), label: 'Labeled instances', source: 'ppe_dataset_report.json', href: '#ppe' },
    { value: throughputRatio, unit: '×', label: 'Measured CPU throughput gain', source: 'ONNX RT / PyTorch · CPU', href: '#performance' },
    { value: String(Object.keys(ppeEvaluation.per_class_metrics).length).padStart(2, '0'), label: 'Evaluated PPE classes', source: 'ppe_test_results.json', href: '#ppe' },
  ];
  return (
    <section aria-label="Measured engineering in numbers" className="surface-optical border-b border-border">
      <div className="vg-container">
        <ul className="grid grid-cols-2 lg:grid-cols-4">
          {stats.map(({ value, unit, label, source, href }, index) => (
            <li
              key={label}
              className={cn(
                'border-border',
                index % 2 === 1 && 'border-l',
                index >= 2 && 'border-t lg:border-t-0',
                index === 2 && 'lg:border-l',
              )}
            >
              <a
                href={href}
                className="group relative flex h-full flex-col px-4 py-6 pr-10 transition-colors duration-micro ease-standard hover:bg-muted sm:px-6 sm:pr-12 lg:py-8"
              >
                <MetricDisplay label={label} value={value} unit={unit} context={breakable(source)} />
                <ArrowUpRight
                  className="absolute right-4 top-6 h-4 w-4 text-muted-foreground sm:right-6 lg:top-8 transition-transform duration-micro ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const ppeFeatures = [
  'Person-centric equipment association',
  'Temporal confirmation and recovery',
  'Zone-aware rules and evidence capture',
];

// Illustrative figure content only: which items are observed is hand-authored, not model output.
const illustrativeEquipment = [
  { item: 'Helmet', observed: true },
  { item: 'Vest', observed: true },
  { item: 'Gloves', observed: false },
];

function FlowArrow() {
  return <ArrowDown className="mx-auto my-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

export function PpeSection() {
  const classes = ppeEvaluation.per_class_metrics;
  const classCount = Object.keys(classes).length;
  const metrics = [
    { label: 'Helmet AP@50', value: classes.helmet.mAP50, context: 'Class · helmet' },
    { label: 'Vest AP@50', value: classes.vest.mAP50, context: 'Class · vest' },
    { label: 'Person AP@50', value: classes.Person.mAP50, context: 'Class · person' },
    { label: 'Overall mAP@50', value: ppeEvaluation.metrics.mAP50, context: `All ${classCount} classes` },
  ];

  return (
    <section id="ppe" aria-labelledby="ppe-heading" className="vg-section border-b border-border bg-background text-foreground">
      <div className="vg-container">
        <SectionIntro
          id="ppe-heading"
          index="03"
          label="Custom model / PPE"
          description="YOLOv8 fine-tuning meets person-centric logic. Equipment detections become a temporal compliance state tied to a tracked person."
        >
          Safety has<br />a context.
        </SectionIntro>

        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div>
            <p className="vg-label inline-flex border border-border-strong bg-surface px-2 py-1 text-foreground">Custom training → held-out evaluation</p>
            <h3 className="mt-6 font-display text-heading font-bold leading-[1.05] tracking-[-0.025em]">
              A helmet is an object.<br />Compliance is a relationship.
            </h3>
            <p className="mt-5 max-w-measure text-body text-muted-foreground">
              Fine-tuned on the training split of a {ppeDataset.summary.total_images.toLocaleString('en-US')}-image Construction-PPE dataset
              with {ppeDataset.summary.total_annotated_instances.toLocaleString('en-US')} labeled instances overall. The pipeline associates
              equipment with each person, smooths observations over time, and applies the requirements of the relevant zone.
            </p>
            <ul className="mt-6 max-w-measure border-t border-border">
              {ppeFeatures.map(feature => (
                <li key={feature} className="flex items-center gap-3 border-b border-border py-3 text-body-sm font-medium">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-border-strong bg-surface">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <SourceLink href="/engineering/ppe_dataset_report.json">Inspect dataset report</SourceLink>
            </div>
          </div>

          <ViewportFrame
            as="figure"
            aria-label="Illustrative diagram of the PPE compliance logic"
            label={<span className="inline-flex items-center gap-2"><HardHat className="h-4 w-4" aria-hidden="true" />Compliance logic</span>}
            meta={<span className="vg-label border border-border px-1.5 text-muted-foreground">Illustrative</span>}
            footer={<><span>DIAGRAM · NOT MODEL OUTPUT</span><span>PER PERSON TRACK</span></>}
          >
            <ol className="p-5 sm:p-6">
              <li>
                <div className="flex items-center justify-between gap-3 border border-l-[3px] border-border-strong border-l-track bg-background px-4 py-3">
                  <span className="vg-label text-foreground">Person track</span>
                  <span className="vg-telemetry text-track-ink">+ ZONE POLICY</span>
                </div>
              </li>
              <li>
                <FlowArrow />
                <ul className="grid grid-cols-3 gap-2" aria-label="Equipment state">
                  {illustrativeEquipment.map(({ item, observed }) => (
                    <li
                      key={item}
                      className={cn(
                        'flex flex-col items-center gap-1.5 border px-1 py-3 text-center',
                        observed ? 'border-border-strong bg-background' : 'border-danger bg-danger text-danger-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center',
                          observed ? 'bg-success text-success-foreground' : 'border border-current',
                        )}
                      >
                        {observed ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                      </span>
                      <span className="vg-label">{item}</span>
                      <span className={cn('vg-telemetry', observed && 'text-success-ink')}>{observed ? 'OBSERVED' : 'MISSING'}</span>
                    </li>
                  ))}
                </ul>
              </li>
              <li>
                <FlowArrow />
                <div className="border border-border-strong bg-surface px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="vg-label text-foreground">Temporal confirmation</span>
                    <span className="vg-telemetry text-muted-foreground">GLOVES · MISSING</span>
                  </div>
                  <span aria-hidden="true" className="mt-3 flex gap-1.5">
                    {Array.from({ length: 6 }, (_, i) => <span key={i} className="h-2.5 flex-1 bg-danger" />)}
                  </span>
                  <p className="mt-3 text-body-sm text-muted-foreground">Repeated observations → confirmed state</p>
                </div>
              </li>
              <li>
                <FlowArrow />
                <div className="flex items-center justify-between gap-3 border border-danger bg-danger px-4 py-3 text-danger-foreground">
                  <span className="vg-label">PPE violation</span>
                  <span className="vg-telemetry">→ EVIDENCE</span>
                </div>
              </li>
            </ol>
          </ViewportFrame>
        </div>

        <div className="mt-16 lg:mt-20">
          <div className="vg-label mb-3 flex flex-col gap-1 text-muted-foreground sm:flex-row sm:justify-between">
            <span className="text-foreground">Held-out PPE test set</span>
            <span>512 PX INPUT / 20 SEP 2026</span>
          </div>
          <ul className="grid grid-cols-2 gap-px border border-border-strong bg-border lg:grid-cols-4">
            {metrics.map(({ label, value, context }, index) => (
              <li key={label} className="relative bg-surface p-5 sm:p-6">
                {index === metrics.length - 1 && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-signal" />}
                <MetricDisplay label={label} value={percent(value)} context={context} />
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-10">
            <p className="max-w-measure text-body-sm text-muted-foreground">
              Overall mAP@50–95: <strong className="font-semibold text-foreground">{percent(ppeEvaluation.metrics.mAP50_95)}</strong> across
              all {classCount} classes. Missing-equipment classes remain weaker; no_boots AP@50
              is <strong className="font-semibold text-foreground">{percent(classes.no_boots.mAP50)}</strong>. This is an evaluated project model,
              not a certified safety system.
            </p>
            <SourceLink href="/engineering/ppe_test_results.json">Full evaluation JSON</SourceLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Performance() {
  const { configuration, backends } = ppeBenchmark;
  const { pytorch, onnxruntime } = backends;
  const rows = [
    { name: 'PyTorch', runtime: 'CPU / FP32', result: pytorch, fill: 'bg-muted-foreground' },
    { name: 'ONNX Runtime', runtime: 'CPUExecutionProvider', result: onnxruntime, fill: 'bg-signal' },
  ];
  const conditions: [string, ReactNode][] = [
    ['Hardware', 'Intel Core i5-13420H · CPU only'],
    ['Input', `${configuration.image_size} × ${configuration.image_size} px`],
    ['Runs', `${configuration.warmup_runs} warmup + ${configuration.measured_runs} measured`],
    ['Recorded', ppeBenchmark.benchmark_timestamp.slice(0, 10)],
    ['GPU · TensorRT', <span key="nm" className="vg-telemetry">NOT_MEASURED</span>],
  ];

  return (
    <section id="performance" aria-labelledby="performance-heading" className="vg-section-dense border-b border-border bg-surface text-foreground">
      <div className="vg-container">
        <SectionIntro
          id="performance-heading"
          index="04"
          label="Measured performance"
          description="Same PPE model. Same CPU. Two inference backends. Recorded measurements, with the conditions attached."
        >
          Benchmarks.<br />Not buzzwords.
        </SectionIntro>

        {/* Instrument readout: an optical panel set into the paper section. */}
        <div className="surface-optical grid border border-border-strong bg-background text-foreground lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="flex flex-col border-b border-border p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <TechnicalLabel>ONNX Runtime / PyTorch</TechnicalLabel>
            <div className="lg:my-auto lg:py-10">
              <p className="mt-8 font-display text-[clamp(5rem,3.5rem+7vw,9rem)] font-extrabold leading-[0.85] tracking-[-0.05em] tabular [font-stretch:85%]">
                {throughputRatio}<span className="ml-1 font-mono text-[0.4em] font-medium tracking-normal text-signal">×</span>
              </p>
              <h3 className="mt-5 font-display text-title font-bold uppercase leading-tight tracking-[-0.01em] [font-stretch:92%]">
                Measured CPU<br />inference throughput
              </h3>
            </div>
            <p className="vg-telemetry mt-8 flex justify-between gap-3 border-t border-border pt-4 text-muted-foreground lg:mt-0">
              <span className="text-foreground">CPU ONLY</span>
              <span>RATIO OF MEASURED FPS</span>
            </p>
          </div>

          <div className="flex flex-col">
            <ul className="flex-1">
              {rows.map(({ name, runtime, result, fill }) => (
                <li key={name} className="border-b border-border p-6 sm:p-8">
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-display text-title font-bold uppercase tracking-[-0.01em] [font-stretch:92%]">{name}</h3>
                    <span className="vg-label text-muted-foreground">{runtime}</span>
                  </div>
                  <MetricDisplay label="Throughput" value={result.fps.toFixed(2)} unit="FPS" />
                  <div className="mt-4">
                    <MeasuredBar fraction={result.fps / onnxruntime.fps} className={fill} />
                  </div>
                  <dl className="vg-telemetry mt-4 flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                    <div className="flex gap-2"><dt>MEAN</dt><dd className="text-foreground">{result.mean_latency_ms.toFixed(2)} ms</dd></div>
                    <div className="flex gap-2"><dt>P95</dt><dd className="text-foreground">{result.p95_latency_ms.toFixed(2)} ms</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            <p className="vg-telemetry px-6 py-3 text-muted-foreground sm:px-8">BAR LENGTH = FPS RELATIVE TO ONNX RUNTIME</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-5">
          {conditions.map(([term, detail], index) => (
            <div key={term} className={cn('bg-background px-4 py-3', index === 0 && 'col-span-2 lg:col-span-1')}>
              <dt className="vg-label text-muted-foreground">{term}</dt>
              <dd className="mt-1 text-body-sm text-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-10">
          <p className="max-w-measure text-body-sm text-muted-foreground">
            Isolated inference throughput; full video pipeline performance varies. GPU and TensorRT results: NOT_MEASURED.
          </p>
          <SourceLink href="/engineering/ppe_inference_benchmarks.json">Inspect benchmark JSON</SourceLink>
        </div>
      </div>
    </section>
  );
}

