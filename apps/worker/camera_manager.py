import logging
from typing import Any

import redis
from vigilai_api.cv.tracking.byte_tracker import ByteTrackTracker

from apps.worker.pipeline import CameraPipeline

logger = logging.getLogger(__name__)


class CameraManager:
    """Manages multiple camera pipelines with per-camera model selection and detector caching."""

    def __init__(self, detector, redis_client: redis.Redis, config: Any):
        self._pipelines: dict[str, CameraPipeline] = {}
        self._default_detector = detector
        self._detector_cache: dict[str, Any] = {}
        if detector is not None:
            self._detector_cache["default"] = detector
        self._redis = redis_client
        self._config = config

    def get_detector(self, model_id: str | None) -> Any:
        """Resolve and cache detector instance for a specific model ID."""
        if not model_id and self._default_detector:
            return self._default_detector

        from vigilai_api.core.models_registry import get_model_metadata

        meta = get_model_metadata(model_id)
        if meta.id in self._detector_cache:
            return self._detector_cache[meta.id]

        logger.info(f"Loading detector for model: {meta.id} ({meta.name})")
        detector = None

        if meta.framework == "onnxruntime":
            try:
                from vigilai_api.cv.detection.onnx_detector import ONNXDetector

                detector = ONNXDetector(
                    model_path=meta.weights_path,
                    device=getattr(self._config, "model_device", "cpu"),
                )
                detector.conf = getattr(self._config, "model_confidence", 0.25)
                detector.iou = getattr(self._config, "model_iou", 0.45)
                detector.img_size = meta.img_size
            except Exception as e:
                logger.warning(
                    f"Failed to load ONNX detector for {meta.id}: {e}. Trying PyTorch fallback if available."
                )
                if meta.task == "ppe_safety":
                    try:
                        from vigilai_api.cv.detection.yolo import YOLODetector

                        detector = YOLODetector(
                            model_path="models/vigilai_ppe_v2.pt",
                            device=getattr(self._config, "model_device", "cpu"),
                        )
                        detector.conf = getattr(self._config, "model_confidence", 0.25)
                        detector.iou = getattr(self._config, "model_iou", 0.45)
                        detector.img_size = meta.img_size
                    except Exception as fallback_e:
                        logger.error(f"PyTorch fallback also failed: {fallback_e}")
                        raise

        if detector is None:
            from vigilai_api.cv.detection.yolo import YOLODetector

            detector = YOLODetector(
                model_path=meta.weights_path,
                device=getattr(self._config, "model_device", "cpu"),
            )
            detector.conf = getattr(self._config, "model_confidence", 0.25)
            detector.iou = getattr(self._config, "model_iou", 0.45)
            detector.img_size = meta.img_size

        self._detector_cache[meta.id] = detector
        return detector

    def start_camera(self, camera_id: str, camera_config: dict) -> bool:
        """Start processing for a camera."""
        if len(self._pipelines) >= self._config.max_cameras_per_worker:
            raise RuntimeError("Worker camera capacity reached")
        if camera_id in self._pipelines:
            logger.warning(f"Camera {camera_id} is already running.")
            return False

        logger.info(f"Starting camera {camera_id}")

        def tracker_factory():
            return ByteTrackTracker(track_thresh=0.5, track_buffer=30, match_thresh=0.8)

        model_id = camera_config.get("model_id")
        detector = self.get_detector(model_id)

        pipeline = CameraPipeline(
            camera_id=camera_id,
            camera_config=camera_config,
            detector=detector,
            tracker_factory=tracker_factory,
            redis_client=self._redis,
            evidence_dir=self._config.evidence_dir,
            frame_queue_size=self._config.frame_queue_size,
        )
        pipeline.start()
        self._pipelines[camera_id] = pipeline
        return True

    def stop_camera(self, camera_id: str) -> bool:
        """Stop processing for a camera."""
        pipeline = self._pipelines.pop(camera_id, None)
        if pipeline:
            logger.info(f"Stopping camera {camera_id}")
            pipeline.stop()
            return True
        return False

    def stop_all(self) -> None:
        """Stop all cameras (for shutdown)."""
        logger.info("Stopping all cameras...")
        camera_ids = list(self._pipelines.keys())
        for cam_id in camera_ids:
            self.stop_camera(cam_id)

    def get_pipeline_stats(self, camera_id: str) -> dict | None:
        pipeline = self._pipelines.get(camera_id)
        if pipeline:
            return pipeline.stats.to_dict()
        return None

    def get_all_stats(self) -> dict:
        return {cam_id: pipeline.stats.to_dict() for cam_id, pipeline in self._pipelines.items()}

    @property
    def active_camera_count(self) -> int:
        return len(self._pipelines)
