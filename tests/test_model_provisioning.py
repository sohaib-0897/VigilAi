import argparse
import json
import os
import subprocess
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
    assert production_worker["environment"]["YOLO_MODEL_PATH"] == "/app/models/yolov8n.onnx"
    assert "depends_on" not in production_worker  # Compose merge preserves base dependencies.


def test_production_worker_ignores_a_local_model_path_override():
    root = Path(__file__).resolve().parents[1]
    base = yaml.safe_load((root / "docker-compose.yml").read_text(encoding="utf-8"))
    production = yaml.load(
        (root / "docker-compose.prod.yml").read_text(encoding="utf-8"),
        Loader=_ComposeLoader,
    )

    local_environment = {"YOLO_MODEL_PATH": "yolov8n.pt"}
    base_worker_path = base["services"]["worker"]["environment"]["YOLO_MODEL_PATH"]
    production_worker_path = production["services"]["worker"]["environment"][
        "YOLO_MODEL_PATH"
    ]
    from vigilai_api.core.models_registry import get_model_metadata

    default_model = get_model_metadata("coco-yolov8n-onnx")

    assert base_worker_path.startswith("${YOLO_MODEL_PATH:")  # Local model selection remains configurable.
    assert local_environment["YOLO_MODEL_PATH"] == "yolov8n.pt"
    assert production_worker_path == "/app/models/yolov8n.onnx"
    assert default_model.id == "coco-yolov8n-onnx"
    assert production_worker_path == f"/app/{default_model.weights_path}"

    environment = os.environ.copy()
    environment.update(
        {
            "YOLO_MODEL_PATH": "yolov8n.pt",
            "DOMAIN": "compose-test.example",
            "POSTGRES_PASSWORD": "compose-validation-only",
            "SECRET_KEY": "compose-validation-only-secret-key-value",
            "ENCRYPTION_KEY": "compose-validation-only-encryption-key",
        }
    )
    rendered = subprocess.run(
        [
            "docker",
            "compose",
            "-f",
            "docker-compose.yml",
            "-f",
            "docker-compose.prod.yml",
            "config",
            "--format",
            "json",
        ],
        cwd=root,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
    )
    config = json.loads(rendered.stdout)
    rendered_worker = config["services"]["worker"]
    rendered_initializer = config["services"]["model-init"]
    expected_path = f"/app/{default_model.weights_path}"

    assert environment["YOLO_MODEL_PATH"] == "yolov8n.pt"
    assert rendered_worker["environment"]["YOLO_MODEL_PATH"] == expected_path
    assert rendered_initializer["command"][
        rendered_initializer["command"].index("--output") + 1
    ] == expected_path
    worker_model_volume = next(
        volume for volume in rendered_worker["volumes"] if volume["target"] == "/app/models"
    )
    initializer_model_volume = next(
        volume
        for volume in rendered_initializer["volumes"]
        if volume["target"] == "/app/models"
    )
    assert worker_model_volume == initializer_model_volume
    assert (
        rendered_worker["depends_on"]["model-init"]["condition"]
        == "service_completed_successfully"
    )
