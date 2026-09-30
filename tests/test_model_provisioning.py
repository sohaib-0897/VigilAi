import argparse
from pathlib import Path

import pytest
import yaml

from scripts.export_onnx import provision_default_model, validate_default_model


def _args(output: Path, *, force: bool = False) -> argparse.Namespace:
    return argparse.Namespace(
        output=str(output),
        skip_if_valid=True,
        force=force,
        model="yolov8n.pt",
        imgsz=640,
        half=False,
        simplify=False,
        dynamic=False,
        opset=17,
    )


def _test_validator(path: Path) -> None:
    if path.read_bytes() != b"valid-model":
        raise ValueError("test model is corrupt")


def _test_exporter(args: argparse.Namespace) -> dict:
    Path(args.output).write_bytes(b"valid-model")
    return {"format": "onnx", "opset": args.opset, "image_size": args.imgsz}


def test_fresh_model_volume_exports_and_atomically_publishes_artifact(tmp_path):
    target = tmp_path / "models" / "yolov8n.onnx"
    result = provision_default_model(
        _args(target), exporter=_test_exporter, validator=_test_validator
    )

    assert target.read_bytes() == b"valid-model"
    assert result["reused"] is False
    assert result["opset"] == 17
    assert list(target.parent.glob(".yolov8n.*.onnx")) == []


def test_already_provisioned_valid_model_is_reused_without_export(tmp_path):
    target = tmp_path / "models" / "yolov8n.onnx"
    target.parent.mkdir()
    target.write_bytes(b"valid-model")

    def unexpected_export(_args):
        pytest.fail("valid existing artifact should be reused")

    result = provision_default_model(
        _args(target), exporter=unexpected_export, validator=_test_validator
    )

    assert result["reused"] is True
    assert target.read_bytes() == b"valid-model"


def test_missing_expected_artifact_has_actionable_validation_error(tmp_path):
    target = tmp_path / "models" / "yolov8n.onnx"

    with pytest.raises(FileNotFoundError, match="missing or empty"):
        validate_default_model(target)


def test_corrupt_existing_artifact_is_regenerated_safely(tmp_path):
    target = tmp_path / "models" / "yolov8n.onnx"
    target.parent.mkdir()
    target.write_bytes(b"corrupt")

    result = provision_default_model(
        _args(target), exporter=_test_exporter, validator=_test_validator
    )

    assert result["reused"] is False
    assert target.read_bytes() == b"valid-model"
    assert list(target.parent.glob(".yolov8n.*.onnx")) == []


def test_invalid_export_fails_and_does_not_publish_partial_artifact(tmp_path):
    target = tmp_path / "models" / "yolov8n.onnx"

    def corrupt_exporter(args):
        Path(args.output).write_bytes(b"corrupt")
        return {}

    with pytest.raises(RuntimeError, match="worker will not start"):
        provision_default_model(_args(target), exporter=corrupt_exporter, validator=_test_validator)

    assert not target.exists()
    assert list(target.parent.glob(".yolov8n.*.onnx")) == []


def test_failed_regeneration_preserves_corrupt_original_for_recovery(tmp_path):
    target = tmp_path / "models" / "yolov8n.onnx"
    target.parent.mkdir()
    target.write_bytes(b"corrupt-original")

    def corrupt_exporter(args):
        Path(args.output).write_bytes(b"corrupt-replacement")
        return {}

    def validator(path: Path) -> None:
        if path.read_bytes() != b"valid-model":
            raise ValueError("test model is corrupt")

    with pytest.raises(RuntimeError, match="worker will not start"):
        provision_default_model(_args(target), exporter=corrupt_exporter, validator=validator)

    assert target.read_bytes() == b"corrupt-original"
    assert list(target.parent.glob(".yolov8n.*.onnx")) == []


class _ComposeLoader(yaml.SafeLoader):
    pass


def _construct_reset(loader, node):
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_scalar(node)


_ComposeLoader.add_constructor("!reset", _construct_reset)


def test_compose_worker_waits_for_idempotent_model_init_in_both_overlays():
    root = Path(__file__).resolve().parents[1]
    base = yaml.safe_load((root / "docker-compose.yml").read_text(encoding="utf-8"))
    production = yaml.load(
        (root / "docker-compose.prod.yml").read_text(encoding="utf-8"),
        Loader=_ComposeLoader,
    )

    initializer = base["services"]["model-init"]
    worker = base["services"]["worker"]
    command = initializer["command"]
    assert "--skip-if-valid" in command
    assert "--download-official-yolov8n" in command
    assert "--imgsz" in command and command[command.index("--imgsz") + 1] == "640"
    assert "--opset" in command and command[command.index("--opset") + 1] == "17"
    assert "model_data:/app/models" in initializer["volumes"]
    assert worker["depends_on"]["model-init"]["condition"] == "service_completed_successfully"
    assert worker["environment"]["YOLO_MODEL_PATH"].endswith("/app/models/yolov8n.onnx}")
    assert "model-init" not in production["services"]
    production_worker = production["services"]["worker"]
    assert production_worker["environment"]["YOLO_MODEL_PATH"].endswith("/app/models/yolov8n.onnx}")
    assert "depends_on" not in production_worker  # Compose merge preserves base dependencies.
