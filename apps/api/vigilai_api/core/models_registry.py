"""
VigilAI — Central Model Registry

Defines verified model configurations, safe public metadata, and runtime detector resolution.
Supports camera-level model selection:
  - General Surveillance (COCO 80 classes / 6 standard surveillance classes)
  - PPE Safety Compliance (VigilAI Construction-PPE v2, 11 classes)
"""

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass
class ModelMetadata:
    id: str
    name: str
    version: str
    task: str
    framework: str  # "onnxruntime" | "pytorch"
    format: str  # "onnx" | "pt"
    weights_path: str
    img_size: int
    classes: list[str]
    is_active: bool
    is_default: bool
    description: str
    metrics: dict[str, Any] | None = None

    def to_safe_dict(self) -> dict[str, Any]:
        """Return safe dictionary excluding internal filesystem paths."""
        d = asdict(self)
        # Exclude raw server filesystem path from public API response
        d.pop("weights_path", None)
        return d


COCO_SURVEILLANCE_CLASSES = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "bus",
    "truck",
]

PPE_11_CLASSES = [
    "helmet",
    "gloves",
    "vest",
    "boots",
    "goggles",
    "none",
    "Person",
    "no_helmet",
    "no_goggle",
    "no_gloves",
    "no_boots",
]

AVAILABLE_MODELS: dict[str, ModelMetadata] = {
    "coco-yolov8n-onnx": ModelMetadata(
        id="coco-yolov8n-onnx",
        name="General Surveillance (YOLOv8n ONNX)",
        version="v8n",
        task="general_surveillance",
        framework="onnxruntime",
        format="onnx",
        weights_path="models/yolov8n.onnx",
        img_size=640,
        classes=COCO_SURVEILLANCE_CLASSES,
        is_active=True,
        is_default=True,
        description="Standard surveillance detection for people and vehicles using CPU-optimized ONNX Runtime.",
        metrics={"fps_cpu": 34.14, "mean_latency_ms": 29.29, "speedup": "1.56x vs PyTorch"},
    ),
    "coco-yolov8n-pt": ModelMetadata(
        id="coco-yolov8n-pt",
        name="General Surveillance (YOLOv8n PyTorch)",
        version="v8n",
        task="general_surveillance",
        framework="pytorch",
        format="pt",
        weights_path="yolov8n.pt",
        img_size=640,
        classes=COCO_SURVEILLANCE_CLASSES,
        is_active=True,
        is_default=False,
        description="Standard surveillance detection for people and vehicles using native PyTorch.",
        metrics={"fps_cpu": 21.83, "mean_latency_ms": 45.81},
    ),
    "vigilai-ppe-v2-onnx": ModelMetadata(
        id="vigilai-ppe-v2-onnx",
        name="PPE Safety Compliance (VigilAI v2 ONNX)",
        version="2.0.0",
        task="ppe_safety",
        framework="onnxruntime",
        format="onnx",
        weights_path="models/vigilai_ppe_v2.onnx",
        img_size=512,
        classes=PPE_11_CLASSES,
        is_active=True,
        is_default=False,
        description="Custom fine-tuned safety model detecting personal protective equipment (helmets, vests, gloves, boots, goggles) and workers on CPU ONNX Runtime.",
        metrics={
            "mAP50": 0.5197,
            "mAP50_95": 0.2608,
            "precision": 0.5045,
            "recall": 0.5043,
            "fps_cpu": 25.59,
            "mean_latency_ms": 39.08,
            "dataset_scale": "1,416 images / 11,521 instances",
        },
    ),
    "vigilai-ppe-v2-pt": ModelMetadata(
        id="vigilai-ppe-v2-pt",
        name="PPE Safety Compliance (VigilAI v2 PyTorch)",
        version="2.0.0",
        task="ppe_safety",
        framework="pytorch",
        format="pt",
        weights_path="models/vigilai_ppe_v2.pt",
        img_size=512,
        classes=PPE_11_CLASSES,
        is_active=True,
        is_default=False,
        description="Custom fine-tuned safety model detecting personal protective equipment using PyTorch weights.",
        metrics={
            "mAP50": 0.5197,
            "mAP50_95": 0.2608,
            "precision": 0.5045,
            "recall": 0.5043,
            "fps_cpu": 16.40,
            "mean_latency_ms": 60.96,
        },
    ),
}

# Aliases for convenient configuration
MODEL_ALIASES: dict[str, str] = {
    "coco": "coco-yolov8n-onnx",
    "coco-yolov8n": "coco-yolov8n-onnx",
    "general": "coco-yolov8n-onnx",
    "general_surveillance": "coco-yolov8n-onnx",
    "ppe": "vigilai-ppe-v2-onnx",
    "vigilai-ppe-v2": "vigilai-ppe-v2-onnx",
    "ppe_safety": "vigilai-ppe-v2-onnx",
}


def get_model_metadata(model_id: str | None) -> ModelMetadata:
    """Retrieve metadata for a given model ID or alias, falling back to default."""
    if not model_id:
        return AVAILABLE_MODELS["coco-yolov8n-onnx"]

    clean_id = model_id.lower().strip()
    resolved_id = MODEL_ALIASES.get(clean_id, clean_id)
    if resolved_id in AVAILABLE_MODELS:
        return AVAILABLE_MODELS[resolved_id]

    # Fallback to default
    return AVAILABLE_MODELS["coco-yolov8n-onnx"]


def list_available_models() -> list[dict[str, Any]]:
    """Return safe public metadata for all active models in the registry."""
    return [m.to_safe_dict() for m in AVAILABLE_MODELS.values() if m.is_active]


def is_ppe_model(model_id: str | None) -> bool:
    """Check if the given model ID represents a PPE safety model."""
    meta = get_model_metadata(model_id)
    return meta.task == "ppe_safety"
