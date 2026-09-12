import json
import logging
import signal
import sys
import time

import redis
from vigilai_api.cv.detection.yolo import YOLODetector

from apps.worker.camera_manager import CameraManager
from apps.worker.config import settings
from apps.worker.heartbeat import HeartbeatManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


class WorkerApp:
    def __init__(self):
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        self.raw_redis_client = redis.from_url(settings.redis_url)  # for bytes

        from vigilai_api.cv.detection.onnx_detector import ONNXDetector

        detector_type = ONNXDetector if settings.model_path.endswith(".onnx") else YOLODetector
        self.detector = detector_type(
            model_path=settings.model_path,
            device=settings.model_device,
        )
        # Configure detector settings after construction
        self.detector.conf = settings.model_confidence
        self.detector.iou = settings.model_iou
        self.detector.img_size = settings.img_size
        self.detector.enabled_classes = settings.enabled_classes

        self.camera_manager = CameraManager(
            detector=self.detector, redis_client=self.raw_redis_client, config=settings
        )

        self.heartbeat = HeartbeatManager(
            worker_id=settings.worker_id,
            redis_client=self.redis_client,
            camera_manager=self.camera_manager,
            interval=settings.heartbeat_interval,
        )

        self.running = False

    def start(self):
        self.running = True
        self.heartbeat.start()

        # Subscribe to per-camera command channels using pattern subscription
        # The API publishes to "vigilai:camera:{camera_id}:command"
        pubsub = self.redis_client.pubsub()
        pubsub.psubscribe("vigilai:camera:*:command")

        # Also subscribe to a global worker commands channel
        pubsub.subscribe("vigilai:worker:commands")

        logger.info(f"Worker {settings.worker_id} started. Listening for commands...")
        last_reconcile = 0.0

        while self.running:
            if time.monotonic() - last_reconcile >= 3:
                from apps.worker.db import desired_cameras, load_camera

                try:
                    desired = set(desired_cameras())
                    for cid in list(self.camera_manager._pipelines):
                        if cid not in desired:
                            self.camera_manager.stop_camera(cid)
                    for cid in desired:
                        if cid not in self.camera_manager._pipelines:
                            try:
                                self.camera_manager.start_camera(cid, load_camera(cid))
                            except Exception:
                                logger.exception("Camera startup failed: %s", cid)
                except Exception:
                    logger.exception("Camera reconciliation failed")
                last_reconcile = time.monotonic()
            message = pubsub.get_message(timeout=1.0)
            if message and message["type"] in ("message", "pmessage"):
                try:
                    data = json.loads(message["data"])
                    cmd = data.get("command")

                    if message["type"] == "pmessage":
                        # Extract camera_id from channel pattern "vigilai:camera:{id}:command"
                        channel = message.get("channel", "")
                        parts = channel.split(":")
                        cam_id = parts[2] if len(parts) >= 4 else None
                    else:
                        cam_id = data.get("camera_id")

                    if cmd == "start" and cam_id:
                        from apps.worker.db import load_camera

                        cam_config = load_camera(cam_id)
                        self.camera_manager.start_camera(cam_id, cam_config)
                    elif cmd == "stop" and cam_id:
                        self.camera_manager.stop_camera(cam_id)
                except Exception as e:
                    logger.error(f"Error processing command: {e}")

        pubsub.close()
        self.shutdown()

    def shutdown(self):
        logger.info("Worker shutting down...")
        self.running = False
        self.heartbeat.stop()
        self.camera_manager.stop_all()
        logger.info("Worker shutdown complete.")


def main():
    app = WorkerApp()

    def handle_sigterm(signum, frame):
        logger.info("Received termination signal")
        app.running = False

    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    try:
        if settings.worker_id:
            try:
                from apps.worker.prom_metrics import PROM_AVAILABLE, start_http_server

                if PROM_AVAILABLE:
                    start_http_server(8001)
                    logger.info("Prometheus metrics server started on port 8001")
            except Exception as e:
                logger.warning(f"Failed to start prometheus metrics: {e}")

        app.start()
    except Exception as e:
        logger.error(f"Worker crashed: {e}")
        app.shutdown()
        sys.exit(1)


if __name__ == "__main__":
    main()
