import json
import logging
import threading
import time

import psutil

logger = logging.getLogger(__name__)


class HeartbeatManager:
    """Sends periodic worker heartbeat to Redis."""

    def __init__(self, worker_id: str, redis_client, camera_manager, interval: int = 5):
        self._worker_id = worker_id
        self._redis = redis_client
        self._camera_manager = camera_manager
        self._interval = interval
        self._running = False
        self._thread = None
        self._start_time = time.time()

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._thread.start()
        logger.info(f"Heartbeat started for worker {self._worker_id}")

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)

    def _heartbeat_loop(self) -> None:
        """Send heartbeat with worker stats to Redis every interval seconds."""
        while self._running:
            try:
                payload = {
                    "worker_id": self._worker_id,
                    "timestamp": time.time(),
                    "active_cameras": self._camera_manager.active_camera_count,
                    "cpu_percent": psutil.cpu_percent(),
                    "memory_percent": psutil.virtual_memory().percent,
                    "uptime_seconds": time.time() - self._start_time,
                    "pipeline_stats": self._camera_manager.get_all_stats(),
                }
                self._redis.publish("worker_heartbeat", json.dumps(payload))
                self._redis.setex(
                    f"worker:{self._worker_id}:status", self._interval * 2, json.dumps(payload)
                )
            except Exception as e:
                logger.error(f"Failed to send heartbeat: {e}")
            time.sleep(self._interval)
