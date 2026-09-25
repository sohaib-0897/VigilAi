"""
VigilAI — Model Evaluation Script

Evaluates a trained YOLO model on a validation/test dataset.
Reports real metrics: precision, recall, mAP@50, mAP@50-95.

Usage:
    python scripts/evaluate.py --model path/to/best.pt --data path/to/data.yaml
"""

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VigilAI Model Evaluation")
    parser.add_argument("--model", type=str, required=True, help="Path to model weights")
    parser.add_argument("--data", type=str, required=True, help="Path to data.yaml")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--device", type=str, default="", help="Device")
    parser.add_argument("--split", type=str, default="val", help="Dataset split: val or test")
    parser.add_argument("--output", type=str, default="benchmarks", help="Output directory")
    parser.add_argument("--output-file", type=str, default="", help="Custom output JSON file path")
    return parser.parse_args()


def evaluate(args: argparse.Namespace) -> dict:
    """Run model evaluation."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics is not installed.")
        sys.exit(1)

    model_path = Path(args.model)
    if not model_path.exists():
        print(f"ERROR: Model not found: {args.model}")
        sys.exit(1)

    print(f"\n{'=' * 60}")
    print("  VigilAI Model Evaluation")
    print(f"  Model: {args.model}")
    print(f"  Dataset: {args.data}")
    print(f"  Split: {args.split}")
    print(f"  Image size: {args.imgsz}")
    print(f"{'=' * 60}\n")

    model = YOLO(str(model_path))

    results = model.val(
        data=args.data,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device or None,
        split=args.split,
        plots=True,
        verbose=True,
    )

    # Extract metrics
    report = {
        "model": args.model,
        "dataset": args.data,
        "split": args.split,
        "image_size": args.imgsz,
        "evaluated_at": datetime.now(UTC).isoformat(),
    }

    if hasattr(results, "results_dict"):
        rd = results.results_dict
        report["metrics"] = {
            "precision": round(rd.get("metrics/precision(B)", 0), 4),
            "recall": round(rd.get("metrics/recall(B)", 0), 4),
            "mAP50": round(rd.get("metrics/mAP50(B)", 0), 4),
            "mAP50_95": round(rd.get("metrics/mAP50-95(B)", 0), 4),
        }
    else:
        report["metrics"] = "NOT_MEASURED"

    # Per-class metrics if available
    class_names = model.names if hasattr(model, "names") else {}
    per_class = {}
    if hasattr(results, "box") and results.box is not None:
        b = results.box
        ap50_vals = getattr(b, "ap50", None)
        ap_vals = getattr(b, "ap", None)
        p_vals = getattr(b, "p", None)
        r_vals = getattr(b, "r", None)
        f1_vals = getattr(b, "f1", None)
        for i, name in class_names.items():
            entry = {}
            if ap50_vals is not None and i < len(ap50_vals):
                entry["mAP50"] = round(float(ap50_vals[i]), 4)
            if ap_vals is not None and i < len(ap_vals):
                entry["mAP50_95"] = round(float(ap_vals[i]), 4)
            if p_vals is not None and i < len(p_vals):
                entry["precision"] = round(float(p_vals[i]), 4)
            if r_vals is not None and i < len(r_vals):
                entry["recall"] = round(float(r_vals[i]), 4)
            per_class[name] = entry
    elif hasattr(results, "maps") and results.maps is not None:
        for i, m in enumerate(results.maps):
            class_name = class_names.get(i, f"class_{i}")
            per_class[class_name] = {"mAP50_95": round(float(m), 4)}
    report["per_class_metrics"] = per_class

    # Save report
    if args.output_file:
        report_path = Path(args.output_file)
        report_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        output_dir = Path(args.output)
        output_dir.mkdir(parents=True, exist_ok=True)
        report_path = output_dir / "evaluation_results.json"

    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'=' * 60}")
    print("  Evaluation Complete")
    if isinstance(report.get("metrics"), dict):
        m = report["metrics"]
        print(f"  Precision: {m['precision']}")
        print(f"  Recall: {m['recall']}")
        print(f"  mAP@50: {m['mAP50']}")
        print(f"  mAP@50-95: {m['mAP50_95']}")
    print(f"  Report: {report_path}")
    print(f"{'=' * 60}")

    return report


if __name__ == "__main__":
    args = parse_args()
    evaluate(args)
