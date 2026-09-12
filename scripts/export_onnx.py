"""
VigilAI — ONNX Export Script

Exports a YOLO model to ONNX format for optimized inference.

Usage:
    python scripts/export_onnx.py --model yolov8n.pt --output models/yolov8n.onnx
    python scripts/export_onnx.py --model path/to/best.pt --imgsz 640 --simplify
"""

import argparse
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VigilAI ONNX Export")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="PyTorch model path")
    parser.add_argument("--output", type=str, default=None, help="Output ONNX path")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--half", action="store_true", help="FP16 export")
    parser.add_argument("--simplify", action="store_true", help="Simplify ONNX graph")
    parser.add_argument("--dynamic", action="store_true", help="Dynamic batch size")
    parser.add_argument("--opset", type=int, default=17, help="ONNX opset version")
    return parser.parse_args()


def export_onnx(args: argparse.Namespace) -> dict:
    """Export model to ONNX format."""
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
    print("  VigilAI ONNX Export")
    print(f"  Model: {args.model}")
    print(f"  Image size: {args.imgsz}")
    print(f"  FP16: {args.half}")
    print(f"  Simplify: {args.simplify}")
    print(f"  Dynamic: {args.dynamic}")
    print(f"  Opset: {args.opset}")
    print(f"{'=' * 60}\n")

    model = YOLO(str(model_path))
    start_time = time.time()

    # Export
    export_path = model.export(
        format="onnx",
        imgsz=args.imgsz,
        half=args.half,
        simplify=args.simplify,
        dynamic=args.dynamic,
        opset=args.opset,
    )

    export_time = time.time() - start_time

    # Get output path
    if export_path:
        onnx_path = Path(str(export_path))
    else:
        onnx_path = model_path.with_suffix(".onnx")

    # Move to specified output if provided
    if args.output and onnx_path.exists():
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        import shutil

        shutil.move(str(onnx_path), str(output_path))
        onnx_path = output_path

    # Verify export
    if not onnx_path.exists():
        print(f"ERROR: Export failed - output file not found: {onnx_path}")
        sys.exit(1)

    file_size_mb = onnx_path.stat().st_size / (1024 * 1024)

    report = {
        "source_model": args.model,
        "output_path": str(onnx_path),
        "format": "onnx",
        "opset": args.opset,
        "image_size": args.imgsz,
        "fp16": args.half,
        "simplified": args.simplify,
        "dynamic_batch": args.dynamic,
        "file_size_mb": round(file_size_mb, 2),
        "export_time_seconds": round(export_time, 2),
        "exported_at": datetime.now(UTC).isoformat(),
    }

    # Validate with ONNX Runtime if available
    try:
        import numpy as np
        import onnxruntime as ort

        session = ort.InferenceSession(str(onnx_path))
        input_info = session.get_inputs()[0]
        output_info = [o.name for o in session.get_outputs()]

        # Run inference test
        dummy_input = np.random.randn(1, 3, args.imgsz, args.imgsz).astype(np.float32)
        test_start = time.time()
        session.run(None, {input_info.name: dummy_input})
        test_time = (time.time() - test_start) * 1000

        report["onnx_validation"] = {
            "valid": True,
            "input_name": input_info.name,
            "input_shape": str(input_info.shape),
            "output_names": output_info,
            "test_inference_ms": round(test_time, 2),
        }
        print(f"  ONNX Runtime validation: PASSED ({test_time:.1f}ms)")
    except ImportError:
        report["onnx_validation"] = {"valid": "NOT_TESTED", "reason": "onnxruntime not installed"}
    except Exception as e:
        report["onnx_validation"] = {"valid": False, "error": str(e)}

    # Save report
    report_path = Path("benchmarks") / "onnx_export_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'=' * 60}")
    print("  Export Complete")
    print(f"  Output: {onnx_path}")
    print(f"  Size: {file_size_mb:.2f} MB")
    print(f"  Time: {export_time:.1f}s")
    print(f"  Report: {report_path}")
    print(f"{'=' * 60}")

    return report


if __name__ == "__main__":
    args = parse_args()
    export_onnx(args)
