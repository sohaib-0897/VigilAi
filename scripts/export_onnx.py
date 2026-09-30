"""
VigilAI — ONNX Export Script

Exports a YOLO model to ONNX format for optimized inference.

Usage:
    python scripts/export_onnx.py --model yolov8n.pt --output models/yolov8n.onnx
    python scripts/export_onnx.py --model path/to/best.pt --imgsz 640 --simplify
"""

import argparse
import ast
import json
import os
import sys
import tempfile
import time
from copy import copy
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
    parser.add_argument(
        "--skip-if-valid",
        action="store_true",
        help="Reuse an existing COCO YOLOv8n ONNX artifact after strict runtime validation",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate the artifact even when --skip-if-valid would reuse it",
    )
    parser.add_argument(
        "--download-official-yolov8n",
        action="store_true",
        help="Allow Ultralytics to download only its canonical yolov8n.pt asset when absent",
    )
    return parser.parse_args()


def validate_default_model(onnx_path: Path) -> None:
    """Validate compatibility with the registry's default COCO YOLOv8n model."""
    if not onnx_path.is_file() or onnx_path.stat().st_size == 0:
        raise FileNotFoundError(f"Expected ONNX model artifact is missing or empty: {onnx_path}")

    try:
        import numpy as np
        import onnx
        import onnxruntime as ort
        from vigilai_api.core.models_registry import get_model_metadata

        model = onnx.load(str(onnx_path), load_external_data=False)
        onnx.checker.check_model(model)
        default_model = get_model_metadata("coco-yolov8n-onnx")
        default_domain_opsets = [
            entry.version for entry in model.opset_import if entry.domain in ("", "ai.onnx")
        ]
        if default_domain_opsets != [17]:
            raise ValueError(f"expected default-domain ONNX opset 17, got {default_domain_opsets}")

        session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        inputs = session.get_inputs()
        outputs = session.get_outputs()
        expected_input_shape = [1, 3, default_model.img_size, default_model.img_size]
        if len(inputs) != 1 or inputs[0].shape != expected_input_shape:
            actual = [item.shape for item in inputs]
            raise ValueError(f"expected one input with shape {expected_input_shape}, got {actual}")

        expected_output_shape = [1, 84, 8400]
        if len(outputs) != 1 or outputs[0].shape != expected_output_shape:
            actual = [item.shape for item in outputs]
            raise ValueError(
                f"expected one YOLOv8 COCO output with shape {expected_output_shape}, got {actual}"
            )

        metadata = session.get_modelmeta().custom_metadata_map
        raw_names = metadata.get("names")
        if not raw_names:
            raise ValueError("ONNX metadata is missing the COCO class names")
        parsed_names = ast.literal_eval(raw_names)
        if isinstance(parsed_names, list):
            names = {index: str(name) for index, name in enumerate(parsed_names)}
        elif isinstance(parsed_names, dict):
            names = {int(index): str(name) for index, name in parsed_names.items()}
        else:
            raise ValueError("ONNX metadata class names must be a list or mapping")

        if len(names) != 80:
            raise ValueError(f"expected 80 COCO class labels, got {len(names)}")
        expected_surveillance_names = {
            0: "person",
            1: "bicycle",
            2: "car",
            3: "motorcycle",
            5: "bus",
            7: "truck",
        }
        for class_id, expected_name in expected_surveillance_names.items():
            if names.get(class_id) != expected_name:
                raise ValueError(
                    f"ONNX class {class_id} must be {expected_name!r}, got {names.get(class_id)!r}"
                )

        result = session.run(
            None, {inputs[0].name: np.zeros(expected_input_shape, dtype=np.float32)}
        )
        if len(result) != 1 or list(result[0].shape) != expected_output_shape:
            raise ValueError("ONNX CPU smoke inference returned an incompatible output")
    except Exception as exc:
        raise RuntimeError(f"ONNX model validation failed for {onnx_path}: {exc}") from exc


def provision_default_model(args: argparse.Namespace, *, exporter=None, validator=None) -> dict:
    """Export to a temporary file, validate it, then atomically publish it."""
    if not args.output:
        raise ValueError("--output is required when provisioning a model")

    exporter = exporter or export_onnx
    validator = validator or validate_default_model
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if args.skip_if_valid and not args.force and output_path.exists():
        try:
            validator(output_path)
            print(f"Valid model already provisioned; reusing {output_path}")
            return {"output_path": str(output_path), "reused": True}
        except Exception as exc:
            print(f"Existing model is invalid and will be regenerated: {exc}", file=sys.stderr)

    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{output_path.stem}.", suffix=".onnx", dir=output_path.parent
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    temporary_path.unlink()

    export_args = copy(args)
    export_args.output = str(temporary_path)
    try:
        report = exporter(export_args)
        validator(temporary_path)
        os.replace(temporary_path, output_path)
        print(f"Validated model atomically installed at {output_path}")
        return {**report, "output_path": str(output_path), "reused": False}
    except BaseException as exc:
        temporary_path.unlink(missing_ok=True)
        if isinstance(exc, (KeyboardInterrupt, SystemExit)):
            raise
        raise RuntimeError(
            f"Failed to provision registry model 'coco-yolov8n-onnx' at {output_path}. "
            "The worker will not start until a compatible YOLOv8n COCO ONNX model is present. "
            f"Check first-boot access to the official Ultralytics model download and retry. Cause: {exc}"
        ) from exc


def export_onnx(args: argparse.Namespace) -> dict:
    """Export model to ONNX format."""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics is not installed.")
        sys.exit(1)

    model_path = Path(args.model)
    model = None
    if not model_path.exists():
        if args.model == "yolov8n.pt" and getattr(args, "download_official_yolov8n", False):
            print("Source model is missing; asking Ultralytics for its canonical yolov8n.pt asset.")
            model = YOLO("yolov8n.pt")
            resolved_path = getattr(model, "ckpt_path", None)
            if resolved_path and Path(resolved_path).is_file():
                model_path = Path(resolved_path)
            elif model_path.is_file():
                model = YOLO(str(model_path))
            else:
                raise FileNotFoundError(
                    "Ultralytics completed its official yolov8n.pt lookup but no checkpoint "
                    "file is available to export"
                )
        else:
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

    if model is None:
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
    onnx_path = Path(str(export_path)) if export_path else model_path.with_suffix(".onnx")

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
    if args.skip_if_valid or args.force:
        provision_default_model(args)
    else:
        export_onnx(args)
