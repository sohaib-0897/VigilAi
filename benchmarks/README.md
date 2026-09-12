# Measurement artifacts

These JSON files were already present before the initial GitHub publication. They are preserved as recorded outputs, not represented as rerun during publication.

| Artifact | Scope |
| --- | --- |
| `cpu-pytorch.json` | Recorded CPU PyTorch inference timing, with machine details, 3 warmups and 20 measured runs |
| `onnx_export_report.json` | Recorded ONNX export and validation output |
| `onnx-parity.json` | Class/confidence observations from one comparison; not a formal parity or accuracy evaluation |

The benchmark executes the model on synthetic input. Timing excludes the full decode, tracking, analytics, persistence, and browser path. PyTorch and ONNX timing paths perform different preprocessing/postprocessing work, so results should not be treated as a controlled backend speed comparison. The small retained run is illustrative, not a statistical performance guarantee.

Referenced `.verification/` weights and media are local artifacts excluded from Git. To reproduce a timing run, provide the weights, install project dependencies, and run:

```bash
python scripts/benchmark.py --model path/to/yolov8n.pt --backend pytorch --device cpu --imgsz 640 --warmup 10 --runs 100 --output benchmarks/results.json
```

Fine-tuned precision, recall, mAP, end-to-end throughput, GPU memory, and TensorRT gains: **NOT_MEASURED** for this publication.
