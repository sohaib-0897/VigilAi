// Exact copies of the repository's measured artifacts are served with the page.
// Keep public/engineering files synchronized with benchmarks/ when publishing a new run.
import benchmark from '../../../public/engineering/ppe_inference_benchmarks.json';
import evaluation from '../../../public/engineering/ppe_test_results.json';
import dataset from '../../../public/engineering/ppe_dataset_report.json';

export const ppeBenchmark = benchmark;
export const ppeEvaluation = evaluation;
export const ppeDataset = dataset;
export const throughputRatio = (benchmark.backends.onnxruntime.fps / benchmark.backends.pytorch.fps).toFixed(2);
export const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
