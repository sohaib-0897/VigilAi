"""
VigilAI — Inference Benchmark Script

Benchmarks model inference performance across available backends.
All measurements are from actual execution — never fabricated.

Usage:
    python scripts/benchmark.py
    python scripts/benchmark.py --model yolov8n.pt --warmup 10 --runs 100
    python scripts/benchmark.py --model models/yolov8n.onnx --backend onnx
"""

import argparse
import json
import os
import platform
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VigilAI Inference Benchmark")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Model path")
    parser.add_argument(
        "--backend",
        type=str,
        default="auto",
        choices=["auto", "pytorch", "onnx", "tensorrt"],
        help="Inference backend",
    )
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--device", type=str, default="cpu", help="Device")
    parser.add_argument("--warmup", type=int, default=10, help="Warmup iterations")
    parser.add_argument("--runs", type=int, default=50, help="Measured iterations")
    parser.add_argument("--output", type=str, default="benchmarks/results.json", help="Output file")
    return parser.parse_args()


def get_system_info() -> dict:
    """Collect system information."""
    import psutil

    info = {
        "platform": platform.platform(),
        "python": platform.python_version(),
        "cpu": platform.processor() or "unknown",
        "cpu_count": os.cpu_count(),
        "ram_gb": round(psutil.virtual_memory().total / (1024**3), 1),
    }

    # GPU info
    try:
        import torch

        if torch.cuda.is_available():
            info["gpu"] = torch.cuda.get_device_name(0)
            info["gpu_memory_gb"] = round(
                torch.cuda.get_device_properties(0).total_mem / (1024**3), 1
            )
            info["cuda_version"] = torch.version.cuda
        else:
            info["gpu"] = "NOT_AVAILABLE"
    except ImportError:
        info["gpu"] = "NOT_AVAILABLE"

    return info


def benchmark_pytorch(
    model_path: str, imgsz: int, device: str, warmup: int, runs: int
) -> dict | None:
    """Benchmark PyTorch inference."""
    try:
        from ultralytics import YOLO
    except ImportError:
        return None

    model = YOLO(model_path)

    # Generate test input
    dummy_frame = np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)

    # Warmup
    print(f"  PyTorch warmup ({warmup} iterations)...")
    for _ in range(warmup):
        model.predict(dummy_frame, device=device, verbose=False, imgsz=imgsz)

    # Measured runs
    print(f"  PyTorch benchmark ({runs} iterations)...")
    latencies = []
    for _ in range(runs):
        start = time.perf_counter()
        model.predict(dummy_frame, device=device, verbose=False, imgsz=imgsz)
        latencies.append((time.perf_counter() - start) * 1000)  # ms

    # Model size
    model_size_mb = (
        Path(model_path).stat().st_size / (1024 * 1024) if Path(model_path).exists() else 0
    )

    # Memory usage
    import psutil

    process = psutil.Process(os.getpid())
    cpu_memory_mb = process.memory_info().rss / (1024 * 1024)

    gpu_memory_mb = "NOT_MEASURED"
    try:
        import torch

        if torch.cuda.is_available() and device != "cpu":
            gpu_memory_mb = round(torch.cuda.memory_allocated() / (1024 * 1024), 2)
    except Exception:
        pass

    return {
        "backend": "pytorch",
        "model": model_path,
        "device": device,
        "image_size": imgsz,
        "warmup_runs": warmup,
        "measured_runs": runs,
        "fps": round(1000 / statistics.mean(latencies), 2),
        "mean_latency_ms": round(statistics.mean(latencies), 2),
        "p50_latency_ms": round(statistics.median(latencies), 2),
        "p95_latency_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2),
        "min_latency_ms": round(min(latencies), 2),
        "max_latency_ms": round(max(latencies), 2),
        "std_latency_ms": round(statistics.stdev(latencies), 2) if len(latencies) > 1 else 0,
        "model_size_mb": round(model_size_mb, 2),
        "cpu_memory_mb": round(cpu_memory_mb, 2),
        "gpu_memory_mb": gpu_memory_mb,
    }


def benchmark_onnx(model_path: str, imgsz: int, warmup: int, runs: int) -> dict | None:
    """Benchmark ONNX Runtime inference."""
    try:
        import onnxruntime as ort
    except ImportError:
        print("  ONNX Runtime not available, skipping.")
        return None

    onnx_path = Path(model_path)
    if onnx_path.suffix != ".onnx":
        onnx_path = onnx_path.with_suffix(".onnx")
    if not onnx_path.exists():
        fallback_path = Path("models") / onnx_path.name
        if fallback_path.exists():
            onnx_path = fallback_path
        else:
            print(f"  ONNX model not found: {onnx_path}")
            return None

    providers = ort.get_available_providers()
    use_gpu = "CUDAExecutionProvider" in providers
    selected_providers = (
        ["CUDAExecutionProvider", "CPUExecutionProvider"] if use_gpu else ["CPUExecutionProvider"]
    )

    session = ort.InferenceSession(str(onnx_path), providers=selected_providers)
    input_info = session.get_inputs()[0]

    # Generate test input
    dummy_input = np.random.randn(1, 3, imgsz, imgsz).astype(np.float32)
    input_name = input_info.name

    # Warmup
    print(f"  ONNX Runtime warmup ({warmup} iterations)...")
    for _ in range(warmup):
        session.run(None, {input_name: dummy_input})

    # Measured runs
    print(f"  ONNX Runtime benchmark ({runs} iterations)...")
    latencies = []
    for _ in range(runs):
        start = time.perf_counter()
        session.run(None, {input_name: dummy_input})
        latencies.append((time.perf_counter() - start) * 1000)

    model_size_mb = onnx_path.stat().st_size / (1024 * 1024)

    import psutil

    process = psutil.Process(os.getpid())
    cpu_memory_mb = process.memory_info().rss / (1024 * 1024)

    return {
        "backend": "onnxruntime",
        "model": str(onnx_path),
        "device": "GPU" if use_gpu else "CPU",
        "providers": selected_providers,
        "image_size": imgsz,
        "warmup_runs": warmup,
        "measured_runs": runs,
        "fps": round(1000 / statistics.mean(latencies), 2),
        "mean_latency_ms": round(statistics.mean(latencies), 2),
        "p50_latency_ms": round(statistics.median(latencies), 2),
        "p95_latency_ms": round(sorted(latencies)[int(len(latencies) * 0.95)], 2),
        "min_latency_ms": round(min(latencies), 2),
        "max_latency_ms": round(max(latencies), 2),
        "std_latency_ms": round(statistics.stdev(latencies), 2) if len(latencies) > 1 else 0,
        "model_size_mb": round(model_size_mb, 2),
        "cpu_memory_mb": round(cpu_memory_mb, 2),
        "gpu_memory_mb": "NOT_MEASURED",
    }


def benchmark_tensorrt(model_path: str, imgsz: int, warmup: int, runs: int) -> dict | None:
    """Benchmark TensorRT inference."""
    try:
        import tensorrt  # noqa: F401
    except ImportError:
        print("  TensorRT not available, skipping.")
        return {
            "backend": "tensorrt",
            "status": "NOT_AVAILABLE",
            "reason": "TensorRT not installed",
        }

    # TensorRT benchmark would go here if the library is available
    # This requires building an engine file first
    engine_path = Path(model_path).with_suffix(".engine")
    if not engine_path.exists():
        return {
            "backend": "tensorrt",
            "status": "NOT_MEASURED",
            "reason": f"Engine file not found: {engine_path}. Export with: trtexec --onnx=model.onnx --saveEngine=model.engine",
        }

    return {
        "backend": "tensorrt",
        "status": "NOT_MEASURED",
        "reason": "TensorRT benchmark not yet implemented",
    }


def run_benchmark(args: argparse.Namespace) -> dict:
    """Run complete benchmark suite."""
    print(f"\n{'=' * 60}")
    print("  VigilAI Inference Benchmark")
    print(f"  Model: {args.model}")
    print(f"  Image size: {args.imgsz}")
    print(f"  Device: {args.device}")
    print(f"  Warmup: {args.warmup} | Runs: {args.runs}")
    print(f"{'=' * 60}\n")

    system_info = get_system_info()
    print(f"System: {system_info['platform']}")
    print(f"CPU: {system_info['cpu']} ({system_info['cpu_count']} cores)")
    print(f"RAM: {system_info['ram_gb']} GB")
    print(f"GPU: {system_info.get('gpu', 'NOT_AVAILABLE')}")
    print()

    results = {
        "benchmark_timestamp": datetime.now(UTC).isoformat(),
        "system": system_info,
        "configuration": {
            "model": args.model,
            "image_size": args.imgsz,
            "device": args.device,
            "warmup_runs": args.warmup,
            "measured_runs": args.runs,
        },
        "backends": {},
    }

    # PyTorch benchmark
    if args.backend in ("auto", "pytorch"):
        print("\n[PyTorch Backend]")
        pytorch_result = benchmark_pytorch(
            args.model, args.imgsz, args.device, args.warmup, args.runs
        )
        if pytorch_result:
            results["backends"]["pytorch"] = pytorch_result
            print(
                f"  -> FPS: {pytorch_result['fps']} | Mean: {pytorch_result['mean_latency_ms']}ms | P95: {pytorch_result['p95_latency_ms']}ms"
            )

    # ONNX benchmark
    if args.backend in ("auto", "onnx"):
        print("\n[ONNX Runtime Backend]")
        onnx_result = benchmark_onnx(args.model, args.imgsz, args.warmup, args.runs)
        if onnx_result:
            results["backends"]["onnxruntime"] = onnx_result
            if "fps" in onnx_result:
                print(
                    f"  -> FPS: {onnx_result['fps']} | Mean: {onnx_result['mean_latency_ms']}ms | P95: {onnx_result['p95_latency_ms']}ms"
                )


    # TensorRT benchmark
    if args.backend in ("auto", "tensorrt"):
        print("\n[TensorRT Backend]")
        trt_result = benchmark_tensorrt(args.model, args.imgsz, args.warmup, args.runs)
        if trt_result:
            results["backends"]["tensorrt"] = trt_result

    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'=' * 60}")
    print("  Benchmark Complete")
    print(f"  Results saved: {output_path}")
    print(f"{'=' * 60}")

    return results


if __name__ == "__main__":
    args = parse_args()
    run_benchmark(args)
