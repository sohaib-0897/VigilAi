"""
VigilAI — Model Training Pipeline

Reproducible fine-tuning workflow for YOLO object detection models.
Supports training on custom datasets for surveillance-specific classes.

Usage:
    python scripts/train.py --config training_config.yaml
    python scripts/train.py --data datasets/custom/data.yaml --epochs 50

Requirements:
    - ultralytics >= 8.3.0
    - A YOLO-format dataset with data.yaml
    - GPU recommended (CPU training is very slow)
"""

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VigilAI Model Training Pipeline")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model to fine-tune")
    parser.add_argument("--data", type=str, required=False, help="Path to data.yaml")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Training image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--device", type=str, default="", help="Device: '', 0, cpu")
    parser.add_argument("--project", type=str, default="training_output", help="Output project dir")
    parser.add_argument("--name", type=str, default=None, help="Experiment name")
    parser.add_argument("--patience", type=int, default=10, help="Early stopping patience")
    parser.add_argument("--lr0", type=float, default=0.01, help="Initial learning rate")
    parser.add_argument("--workers", type=int, default=4, help="Dataloader workers")
    parser.add_argument("--augment", action="store_true", default=True, help="Use augmentation")
    parser.add_argument(
        "--resume", action="store_true", help="Resume training from last checkpoint"
    )
    parser.add_argument("--cache", action="store_true", default=False, help="Cache images in RAM for faster training")
    parser.add_argument("--dry-run", action="store_true", help="Validate config without training")
    return parser.parse_args()


def validate_dataset(data_path: str) -> dict:
    """Validate dataset configuration."""
    import yaml

    data_file = Path(data_path)
    if not data_file.exists():
        raise FileNotFoundError(f"Dataset config not found: {data_path}")

    with open(data_file, encoding="utf-8") as f:
        data_config = yaml.safe_load(f)

    required_keys = ["train", "val", "names"]
    for key in required_keys:
        if key not in data_config:
            raise ValueError(f"Missing required key in data.yaml: {key}")

    if "nc" not in data_config:
        data_config["nc"] = len(data_config["names"])

    print(f"Dataset: {data_file}")
    print(f"  Classes ({data_config['nc']}): {data_config['names']}")
    print(f"  Train: {data_config['train']}")
    print(f"  Val: {data_config['val']}")
    if "test" in data_config:
        print(f"  Test: {data_config['test']}")

    return data_config


def train(args: argparse.Namespace) -> dict:
    """Execute training pipeline."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics is not installed. Install with: pip install ultralytics")
        sys.exit(1)

    if not args.data:
        print("ERROR: --data argument is required. Provide path to data.yaml")
        print("\nExample data.yaml format:")
        print("  train: path/to/train/images")
        print("  val: path/to/val/images")
        print("  nc: 6")
        print("  names: ['person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck']")
        sys.exit(1)

    # Validate dataset
    data_config = validate_dataset(args.data)

    experiment_name = args.name or f"vigilai_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}"

    if args.dry_run:
        print("\n[DRY RUN] Configuration validated. Training would use:")
        print(f"  Model: {args.model}")
        print(f"  Epochs: {args.epochs}")
        print(f"  Image size: {args.imgsz}")
        print(f"  Batch size: {args.batch}")
        print(f"  Device: {args.device or 'auto'}")
        print(f"  Output: {args.project}/{experiment_name}")
        return {"status": "dry_run", "config_valid": True}

    print(f"\n{'=' * 60}")
    print("  VigilAI Training Pipeline")
    print(f"  Model: {args.model}")
    print(f"  Dataset: {args.data}")
    print(f"  Epochs: {args.epochs}")
    print(f"  Image size: {args.imgsz}")
    print(f"  Batch: {args.batch}")
    print(f"  Device: {args.device or 'auto'}")
    print(f"  Experiment: {experiment_name}")
    print(f"{'=' * 60}\n")

    # Load base model
    model = YOLO(args.model)
    start_time = time.time()

    project_dir = str(Path(args.project).resolve())

    # Train
    results = model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device or None,
        project=project_dir,
        name=experiment_name,
        patience=args.patience,
        lr0=args.lr0,
        workers=args.workers,
        augment=args.augment,
        resume=args.resume,
        cache=args.cache,
        exist_ok=True,
        verbose=True,
        save=True,
        plots=True,
    )

    training_time = time.time() - start_time

    # Extract metrics
    metrics = {
        "experiment_name": experiment_name,
        "base_model": args.model,
        "dataset": args.data,
        "epochs_completed": args.epochs,
        "training_time_seconds": round(training_time, 2),
        "image_size": args.imgsz,
        "batch_size": args.batch,
        "device": args.device or "auto",
        "classes": data_config.get("names", []),
        "num_classes": data_config.get("nc", 0),
    }

    # Extract validation metrics if available
    if hasattr(results, "results_dict"):
        rd = results.results_dict
        metrics["metrics"] = {
            "precision": round(rd.get("metrics/precision(B)", 0), 4),
            "recall": round(rd.get("metrics/recall(B)", 0), 4),
            "mAP50": round(rd.get("metrics/mAP50(B)", 0), 4),
            "mAP50_95": round(rd.get("metrics/mAP50-95(B)", 0), 4),
        }
    else:
        metrics["metrics"] = "NOT_MEASURED"

    # Save training report
    output_dir = Path(getattr(results, "save_dir", Path(project_dir) / experiment_name))
    output_dir.mkdir(parents=True, exist_ok=True)
    report_path = output_dir / "training_report.json"
    with open(report_path, "w") as f:
        json.dump(metrics, f, indent=2, default=str)

    print(f"\n{'=' * 60}")
    print("  Training Complete")
    print(f"  Duration: {training_time:.1f}s")
    if isinstance(metrics.get("metrics"), dict):
        m = metrics["metrics"]
        print(f"  Precision: {m['precision']}")
        print(f"  Recall: {m['recall']}")
        print(f"  mAP@50: {m['mAP50']}")
        print(f"  mAP@50-95: {m['mAP50_95']}")
    print(f"  Report: {report_path}")
    print(f"  Weights: {output_dir / 'weights'}")
    print(f"{'=' * 60}")

    return metrics


if __name__ == "__main__":
    args = parse_args()
    train(args)
