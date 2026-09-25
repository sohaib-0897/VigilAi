"""
VigilAI — Camera Processing Pipeline

Complete frame processing pipeline for a single camera.
Runs in worker threads, processes video through:
Detection -> Tracking -> Analytics -> Rules -> Events -> Evidence -> Streaming
"""

import contextlib
import json
import logging
import os
import sys
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, UTC
from uuid import uuid4
from typing import Any

import cv2

# Add project root to path for CV module imports
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from vigilai_api.core.models_registry import is_ppe_model
from vigilai_api.cv.analytics.counting import CountingAnalyzer
from vigilai_api.cv.analytics.dwell_analytics import DwellAnalyzer
from vigilai_api.cv.analytics.line_analytics import LineAnalyzer
from vigilai_api.cv.analytics.zone_analytics import ZoneAnalyzer, ZoneTransition
from vigilai_api.cv.annotator import FrameAnnotator
from vigilai_api.cv.events.manager import EventManager
from vigilai_api.cv.evidence.capture import EvidenceCapture
from vigilai_api.cv.ppe import ComplianceStatus, PPEAnalyzer
from vigilai_api.cv.rules.engine import RuleConfig, RulesEngine
from vigilai_api.cv.video.factory import VideoSourceFactory

import apps.worker.db as worker_db
from apps.worker.frame_buffer import FrameBuffer
from apps.worker.metrics import PipelineMetrics

logger = logging.getLogger(__name__)


class CameraPipeline:
    """Complete frame processing pipeline for a single camera.

    Architecture:
    - Reader thread: reads frames from video source into bounded buffer
    - Processor thread: processes frames through CV pipeline

    Frame buffer uses latest-frame semantics: if processing is slower
    than source FPS, old frames are dropped to maintain freshness.
    """

    def __init__(
        self,
        camera_id: str,
        camera_config: dict,
        detector: Any,
        tracker_factory: Callable,
        redis_client: Any,
        evidence_dir: str,
        frame_queue_size: int = 30,
    ):
        self._camera_id = camera_id
        self._camera_config = camera_config
        self._detector = detector
        self._tracker_factory = tracker_factory
        self._redis = redis_client
        self._evidence_dir = evidence_dir

        self._running = False
        self._track_summaries = {}
        self._stop_event = threading.Event()
        self._reader_done = threading.Event()
        self._frame_buffer = FrameBuffer(maxsize=frame_queue_size)
        self._metrics = PipelineMetrics(camera_id)

        self._reader_thread: threading.Thread | None = None
        self._processor_thread: threading.Thread | None = None

        # Analytics components (initialized in _load_camera_config)
        self._tracker = None
        self._zone_analyzer: ZoneAnalyzer | None = None
        self._line_analyzer: LineAnalyzer | None = None
        self._dwell_analyzer: DwellAnalyzer | None = None
        self._counting_analyzer: CountingAnalyzer | None = None
        self._rules_engine: RulesEngine | None = None
        self._event_manager: EventManager | None = None
        self._evidence_capture: EvidenceCapture | None = None
        self._annotator: FrameAnnotator | None = None
        self._is_ppe: bool = False
        self._ppe_analyzer: PPEAnalyzer | None = None

        # Video source
        self._video_source = None

        # Zone/line config for annotation
        self._zone_configs: dict = {}
        self._line_configs: dict = {}
        self._last_loop_count = 0

    def start(self) -> None:
        """Start the pipeline in background threads."""
        if self._running:
            logger.warning(f"Pipeline already running for camera {self._camera_id}")
            return

        logger.info(f"Starting pipeline for camera {self._camera_id}")
        self._load_camera_config()
        self._running = True
        self._stop_event.clear()
        self._reader_done.clear()
        worker_db.update_camera_status(self._camera_id, "connecting")

        self._reader_thread = threading.Thread(
            target=self._reader_loop, name=f"reader-{self._camera_id}", daemon=True
        )
        self._processor_thread = threading.Thread(
            target=self._processor_loop, name=f"processor-{self._camera_id}", daemon=True
        )

        self._reader_thread.start()
        self._processor_thread.start()

        logger.info(f"Pipeline started for camera {self._camera_id}")

    def stop(self) -> None:
        """Stop the pipeline and release all resources."""
        logger.info(f"Stopping pipeline for camera {self._camera_id}")
        self._running = False
        self._stop_event.set()

        if self._reader_thread and self._reader_thread.is_alive():
            self._reader_thread.join(timeout=5.0)
        if self._processor_thread and self._processor_thread.is_alive():
            self._processor_thread.join(timeout=5.0)
        if not self._processor_thread or not self._processor_thread.is_alive():
            self._flush_track_summaries()

        # Release video source
        if self._video_source:
            try:
                self._video_source.close()
            except Exception as e:
                logger.error(f"Error closing video source: {e}")

        # Update status
        try:
            worker_db.update_camera_status(self._camera_id, "stopped", "Pipeline stopped")
            if self._redis:
                self._redis.set(
                    f"vigilai:camera:{self._camera_id}:status",
                    json.dumps({"status": "stopped", "timestamp": time.time()}),
                )
                self._redis.delete(f"vigilai:camera:{self._camera_id}:frame")
        except Exception as e:
            logger.error(f"Error updating status on stop: {e}")

        logger.info(f"Pipeline stopped for camera {self._camera_id}")

    def _reader_loop(self) -> None:
        """Read frames from video source into bounded queue.

        If queue is full, drops oldest frame (freshness over completeness).
        Does NOT busy-loop on failed sources — uses backoff.
        """
        source_type = self._camera_config.get("source_type", "local_video")
        source_uri = self._camera_config.get("source_uri", "")
        if source_type in ("local", "local_video") and not os.path.exists(source_uri):
            filename = os.path.basename(source_uri.replace("\\", "/"))
            candidates = [
                os.path.join(self._camera_config.get("upload_dir", "/app/uploads"), filename),
                os.path.join("/app/uploads", filename),
                os.path.join("/app/data/demo", filename),
                os.path.join(PROJECT_ROOT, "uploads", filename),
                os.path.join(PROJECT_ROOT, "assets", "demo", filename),
                "/app/data/demo/demo_feed.mp4",
                os.path.join(PROJECT_ROOT, "uploads", "demo_feed.mp4"),
            ]
            for candidate in candidates:
                if os.path.isfile(candidate):
                    logger.info("Resolved cross-environment source_uri '%s' -> '%s'", source_uri, candidate)
                    source_uri = candidate
                    break

        try:
            self._video_source = VideoSourceFactory.create(
                source_type, source_uri, loop=True
            )
            failures = 0
            while self._running:
                if not self._video_source.is_open() and not self._video_source.open():
                    worker_db.update_camera_status(
                        self._camera_id, "error", "Unable to open video source"
                    )
                    if source_type == "local_video":
                        break
                    failures += 1
                    self._stop_event.wait(min(2 ** min(failures, 5), 30))
                    continue
                began = time.monotonic()
                ok, frame = self._video_source.read()
                if not ok or frame is None:
                    self._video_source.close()
                    if source_type == "local_video":
                        break
                    failures += 1
                    worker_db.update_camera_status(
                        self._camera_id, "connecting", "Stream unavailable; retrying"
                    )
                    self._stop_event.wait(min(2 ** min(failures, 5), 30))
                    continue
                failures = 0
                loop_count = getattr(self._video_source, "loop_count", 0)
                self._frame_buffer.put(frame, time.time(), loop_count)
                self._metrics.record_frame_received()
                if source_type == "local_video":
                    fps = self._video_source.metadata().fps or 25
                    self._stop_event.wait(max(0, 1 / fps - (time.monotonic() - began)))
        except Exception:
            logger.exception("Video reader failed for camera %s", self._camera_id)
            worker_db.update_camera_status(self._camera_id, "error", "Video reader failed")
        finally:
            if self._video_source:
                self._video_source.close()
            self._reader_done.set()

    def _processor_loop(self) -> None:
        """Process frames through the complete CV pipeline.

        For each frame:
        1. Run detector -> detections
        2. Update tracker -> tracks with persistent IDs
        3. Update zone analytics -> enter/exit transitions
        4. Update line analytics -> crossings
        5. Update dwell analytics -> threshold alerts
        6. Update counting
        7. Evaluate rules -> rule matches
        8. Process events (with deduplication) -> new events only
        9. Capture evidence for new events
        10. Annotate frame for live display
        11. Publish annotated frame to Redis (MJPEG streaming)
        12. Publish events to Redis
        13. Update metrics
        """
        while self._running:
            frame_data = self._frame_buffer.get(timeout=1.0)
            if frame_data is None:
                if self._reader_done.is_set():
                    self._running = False
                    worker_db.update_camera_status(self._camera_id, "stopped", "Source ended")
                    worker_db.finish_camera(self._camera_id)
                    self._flush_track_summaries()
                    break
                continue

            frame, timestamp, loop_count = frame_data

            try:
                if loop_count > self._last_loop_count:
                    self._reset_for_video_replay(timestamp)
                    self._last_loop_count = loop_count
                # 1. Detection
                detection_result = self._detector.detect(frame)
                detections = (
                    detection_result.detections
                    if hasattr(detection_result, "detections")
                    else detection_result
                )
                inference_ms = (
                    detection_result.inference_time_ms
                    if hasattr(detection_result, "inference_time_ms")
                    else 0
                )

                # 2. Tracking
                if self._tracker:
                    if self._is_ppe:
                        tracker_detections = [
                            replace(d, class_name="person") if d.class_name.lower() == "person" else d
                            for d in detections
                            if d.class_name.lower() == "person"
                        ]
                    else:
                        tracker_detections = detections
                    tracking_result = self._tracker.update(tracker_detections, frame)
                    tracks = (
                        tracking_result.tracks
                        if hasattr(tracking_result, "tracks")
                        else tracking_result
                    )
                else:
                    tracks = []

                self._metrics.record_detection(len(tracks))
                for track in tracks:
                    summary = self._track_summaries.setdefault(track.track_id, {
                        "id": uuid4(), "camera_id": self._camera_id,
                        "track_id": track.track_id, "object_class": track.class_name,
                        "first_seen": datetime.fromtimestamp(timestamp, UTC),
                        "total_frames": 0, "zones_visited": [], "lines_crossed": [],
                    })
                    summary["last_seen"] = datetime.fromtimestamp(timestamp, UTC)
                    summary["total_frames"] += 1
                stale = [tid for tid, s in self._track_summaries.items() if timestamp - s["last_seen"].timestamp() > 5]
                for tid in stale:
                    worker_db.save_track_summary(self._track_summaries[tid])
                    del self._track_summaries[tid]
                active_track_ids = {t.track_id for t in tracks}
                h, w = frame.shape[:2]
                geometry_tracks = [
                    replace(
                        t,
                        centroid=(t.centroid[0] / w, t.centroid[1] / h),
                        trajectory=deque(((x / w, y / h) for x, y in t.trajectory), maxlen=100),
                    )
                    for t in tracks
                ]

                # 3. Zone Analytics
                zone_events = []
                if self._zone_analyzer:
                    zone_events = self._zone_analyzer.update(geometry_tracks, timestamp)
                    zone_events += self._zone_analyzer.cleanup_stale_tracks(
                        active_track_ids, timestamp
                    )

                # 4. Line Analytics
                line_events = []
                if self._line_analyzer and tracks:
                    line_events = self._line_analyzer.update(geometry_tracks, timestamp)

                # 5. Dwell Analytics
                dwell_alerts = []
                if self._dwell_analyzer:
                    # Feed zone enter/exit events
                    for ze in zone_events:
                        if ze.transition == ZoneTransition.ENTER:
                            self._dwell_analyzer.on_zone_enter(
                                ze.track_id, ze.zone_id, ze.object_class, timestamp
                            )
                        elif ze.transition == ZoneTransition.EXIT:
                            self._dwell_analyzer.on_zone_exit(ze.track_id, ze.zone_id, timestamp)
                    self._dwell_analyzer.cleanup_stale(active_track_ids)
                    dwell_alerts = self._dwell_analyzer.check_thresholds(timestamp)

                # 6. Counting
                counting_state = None
                if self._counting_analyzer:
                    counting_state = self._counting_analyzer.update(
                        tracks, self._zone_analyzer, self._line_analyzer
                    )

                # 6b. PPE Analytics
                ppe_alerts = []
                ppe_states = {}
                ppe_obs = {}
                if self._ppe_analyzer and tracks:
                    ppe_rules = [
                        r
                        for r in (self._rules_engine._rules if self._rules_engine else [])
                        if r.rule_type == "ppe_violation"
                    ]
                    ppe_alerts, ppe_states = self._ppe_analyzer.update(
                        person_tracks=tracks,
                        all_detections=detections,
                        ppe_rules=ppe_rules,
                        zone_configs=self._zone_configs,
                        frame_shape=frame.shape,
                        timestamp=timestamp,
                    )
                    ppe_obs = self._ppe_analyzer._last_observations

                # 7. Rule Evaluation
                rule_matches = []
                if self._rules_engine:
                    for ze in zone_events:
                        rule_matches.extend(self._rules_engine.evaluate_zone_event(ze))
                    for le in line_events:
                        rule_matches.extend(self._rules_engine.evaluate_line_crossing(le))
                    for da in dwell_alerts:
                        rule_matches.extend(self._rules_engine.evaluate_dwell_alert(da))
                    for pa in ppe_alerts:
                        rule_matches.extend(self._rules_engine.evaluate_ppe_alert(pa))
                    # Check occupancy thresholds
                    if self._zone_analyzer:
                        for zone_id in self._zone_configs:
                            occ = self._zone_analyzer.get_total_occupancy(zone_id)
                            rule_matches.extend(self._rules_engine.evaluate_occupancy(zone_id, occ))

                # 8. Event Processing (with deduplication)
                if self._event_manager:
                    if self._rules_engine:
                        rule_matches.extend(self._rules_engine.evaluate_class_presence(tracks))
                        for zone_id, polygon in self._zone_configs.items():
                            from vigilai_api.cv.geometry.core import point_in_polygon

                            in_zone = [
                                t for t in geometry_tracks if point_in_polygon(t.centroid, polygon)
                            ]
                            rule_matches.extend(
                                self._rules_engine.evaluate_class_presence(in_zone, zone_id)
                            )
                    matched_rules = {m.rule.rule_id for m in rule_matches}
                    exited = {
                        (z.track_id, z.zone_id)
                        for z in zone_events
                        if z.transition == ZoneTransition.EXIT
                    }
                    for active in self._event_manager.get_active_events():
                        if (
                            (active.track_id, active.zone_id) in exited
                            and active.event_type in ("zone_entry", "dwell_time")
                        ) or (
                            active.event_type in ("occupancy_threshold", "class_presence")
                            and active.rule_id not in matched_rules
                        ) or (
                            active.event_type == "ppe_violation"
                            and (
                                (active.track_id in ppe_states and ppe_states[active.track_id].status == ComplianceStatus.COMPLIANT)
                                or (active.zone_id and active.track_id in ppe_states and ppe_states[active.track_id].zone_id != active.zone_id)
                            )
                        ):
                            resolved = self._event_manager.resolve_event(
                                active.fingerprint, timestamp
                            )
                            self._persist_event(resolved)
                    for match in rule_matches:
                        event_record = self._event_manager.process_rule_match(match, frame)
                        if event_record is not None:
                            self._metrics.record_event()

                            # 9. Evidence capture
                            if self._evidence_capture and event_record.evidence_frame is not None:
                                try:
                                    evidence_meta = self._evidence_capture.capture_snapshot(
                                        event_record.evidence_frame,
                                        event_record,
                                        tracks,
                                        self._zone_configs,
                                        self._line_configs,
                                    )
                                    # Persist event + evidence to DB
                                    event_id = self._persist_event(event_record)
                                    self._persist_evidence(evidence_meta, event_id)
                                except Exception as e:
                                    logger.error(f"Evidence capture failed: {e}")
                                    event_id = self._persist_event(event_record)
                            else:
                                event_id = self._persist_event(event_record)

                            event_record.evidence_frame = None
                            if event_record.event_type in ("line_crossing", "zone_exit"):
                                resolved = self._event_manager.resolve_event(
                                    event_record.fingerprint, timestamp
                                )
                                self._persist_event(resolved)

                            # 12. Publish event to Redis
                            if self._redis:
                                try:
                                    event_payload = json.dumps(
                                        {
                                            "event_id": event_record.event_id,
                                            "camera_id": self._camera_id,
                                            "event_type": event_record.event_type,
                                            "severity": event_record.severity,
                                            "object_class": event_record.object_class,
                                            "track_id": event_record.track_id,
                                            "timestamp": event_record.started_at,
                                        }
                                    )
                                    self._redis.publish("vigilai:events", event_payload)
                                except Exception as e:
                                    logger.error(f"Failed to publish event: {e}")

                    # Check for expired events (track gone)
                    resolved = self._event_manager.check_expired_events(active_track_ids, timestamp)
                    for evt in resolved:
                        self._persist_event(evt)

                # Cleanup stale analytics states
                if self._zone_analyzer:
                    self._zone_analyzer.cleanup_stale_tracks(active_track_ids, timestamp)
                if self._line_analyzer:
                    self._line_analyzer.cleanup_stale_tracks(active_track_ids)

                # 10. Annotate frame for live display
                annotated_frame = frame
                if self._annotator:
                    annotated_frame = self._annotator.annotate(
                        frame,
                        tracks,
                        zones=self._zone_configs if self._zone_configs else None,
                        lines=self._line_configs if self._line_configs else None,
                        counts=counting_state,
                        fps=self._metrics.fps,
                        ppe_states=ppe_states if ppe_states else None,
                        ppe_observations=ppe_obs if ppe_obs else None,
                    )

                # 11. Publish annotated frame to Redis (MJPEG streaming)
                if self._redis:
                    try:
                        _, buffer = cv2.imencode(
                            ".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 70]
                        )
                        self._redis.set(
                            f"vigilai:camera:{self._camera_id}:frame",
                            buffer.tobytes(),
                            ex=5,
                        )
                    except Exception as e:
                        logger.error(f"Failed to publish frame: {e}")

                # 13. Update metrics
                self._metrics.record_inference_time(inference_ms)
                self._metrics.record_frame_processed()
                self._metrics.frames_dropped = self._frame_buffer.stats["frames_dropped"]
                if not getattr(self, "_status_marked_online", False):
                    worker_db.update_camera_status(self._camera_id, "online", "Streaming")
                    self._status_marked_online = True

                # Publish status update
                if self._redis and int(time.time()) % 2 == 0:
                    with contextlib.suppress(Exception):
                        self._redis.set(
                            f"vigilai:camera:{self._camera_id}:status",
                            json.dumps(
                                {
                                    "status": "online",
                                    "fps": round(self._metrics.fps, 1),
                                    "frames_processed": self._metrics.frames_processed,
                                    "frames_dropped": self._metrics.frames_dropped,
                                    "active_tracks": len(tracks) if tracks else 0,
                                    "total_events": self._metrics.total_events,
                                    "timestamp": time.time(),
                                }
                            ),
                            ex=10,
                        )

            except Exception as e:
                logger.error(
                    f"Error processing frame for camera {self._camera_id}: {e}",
                    exc_info=True,
                )
                self._metrics.record_error()

    def _load_camera_config(self) -> None:
        """Load zones, lines, rules from database for this camera."""
        # Initialize tracker
        self._tracker = self._tracker_factory()

        # Load zones
        zones_data = worker_db.load_zones(self._camera_id)
        if zones_data:
            zone_polygons = {}
            for z in zones_data:
                zone_id = str(z.get("id", ""))
                points = z.get("points", [])
                if points and zone_id:
                    zone_polygons[zone_id] = [(p["x"], p["y"]) for p in points]
                    self._zone_configs[zone_id] = [(p["x"], p["y"]) for p in points]
            self._zone_analyzer = ZoneAnalyzer()
            self._zone_analyzer.set_zones(zone_polygons)

        # Load lines
        lines_data = worker_db.load_lines(self._camera_id)
        if lines_data:
            line_defs = {}
            for ln in lines_data:
                line_id = str(ln.get("id", ""))
                start = ln.get("start_point", {})
                end = ln.get("end_point", {})
                direction = ln.get("direction_mode", "both")
                if start and end and line_id:
                    line_defs[line_id] = (
                        (start["x"], start["y"]),
                        (end["x"], end["y"]),
                        direction,
                    )
                    self._line_configs[line_id] = (
                        (start["x"], start["y"]),
                        (end["x"], end["y"]),
                        direction,
                    )
            self._line_analyzer = LineAnalyzer()
            self._line_analyzer.set_lines(line_defs)

        # Load rules
        rules_data = worker_db.load_rules(self._camera_id)
        self._rules_engine = RulesEngine()
        if rules_data:
            rule_configs = []
            for r in rules_data:
                rule_configs.append(
                    RuleConfig(
                        rule_id=str(r.get("id", "")),
                        name=r.get("name", ""),
                        rule_type=r.get("rule_type", ""),
                        enabled=r.get("enabled", True),
                        severity=r.get("severity", "medium"),
                        object_classes=r.get("object_classes"),
                        zone_id=str(r["zone_id"]) if r.get("zone_id") else None,
                        line_id=str(r["line_id"]) if r.get("line_id") else None,
                        threshold_value=r.get("threshold_value"),
                        cooldown_seconds=r.get("cooldown_seconds", 30),
                        configuration=r.get("configuration"),
                    )
                )
            self._rules_engine.set_rules(rule_configs)

        # Initialize remaining components
        if not self._zone_analyzer:
            self._zone_analyzer = ZoneAnalyzer()
        if not self._line_analyzer:
            self._line_analyzer = LineAnalyzer()

        self._dwell_analyzer = DwellAnalyzer()
        # Set dwell thresholds from rules
        if rules_data:
            dwell_thresholds = {}
            for r in rules_data:
                if (
                    r.get("rule_type") == "dwell_time"
                    and r.get("zone_id")
                    and r.get("threshold_value") is not None
                ):
                    dwell_thresholds[str(r["zone_id"])] = float(r["threshold_value"])
            if dwell_thresholds:
                self._dwell_analyzer.set_thresholds(dwell_thresholds)

        self._counting_analyzer = CountingAnalyzer()
        self._event_manager = EventManager(self._camera_id)
        self._annotator = FrameAnnotator()

        # Evidence capture
        os.makedirs(self._evidence_dir, exist_ok=True)
        self._evidence_capture = EvidenceCapture(self._evidence_dir)

        # PPE Compliance Analyzer
        model_id = self._camera_config.get("model_id")
        has_ppe_rules = any(r.get("rule_type") == "ppe_violation" for r in (rules_data or []))
        self._is_ppe = is_ppe_model(model_id) or has_ppe_rules
        if self._is_ppe:
            self._ppe_analyzer = PPEAnalyzer(self._camera_id)
        else:
            self._ppe_analyzer = None

        logger.info(
            f"Loaded config for camera {self._camera_id}: "
            f"{len(self._zone_configs)} zones, "
            f"{len(self._line_configs)} lines, "
            f"{len(rules_data) if rules_data else 0} rules"
        )

    def _flush_track_summaries(self):
        for tid in list(self._track_summaries):
            worker_db.save_track_summary(self._track_summaries[tid])
            del self._track_summaries[tid]

    def _reset_for_video_replay(self, timestamp: float) -> None:
        """End state from the previous pass before tracker IDs are reused."""
        if self._event_manager:
            for event in self._event_manager.end_all_events(timestamp):
                self._persist_event(event)
        self._flush_track_summaries()
        self._tracker = None
        self._zone_analyzer = None
        self._line_analyzer = None
        self._dwell_analyzer = None
        self._counting_analyzer = None
        self._rules_engine = None
        self._event_manager = None
        self._ppe_analyzer = None
        self._zone_configs = {}
        self._line_configs = {}
        self._load_camera_config()
        logger.info("Reset camera state at local video replay boundary: %s", self._camera_id)

    def _persist_event(self, event_record) -> str:
        """Save event to database."""
        try:
            event_data = {
                "id": event_record.event_id,
                "camera_id": self._camera_id,
                "rule_id": event_record.rule_id,
                "event_type": event_record.event_type,
                "severity": event_record.severity,
                "object_class": event_record.object_class,
                "track_id": event_record.track_id,
                "zone_id": event_record.zone_id,
                "line_id": event_record.line_id,
                "fingerprint": event_record.fingerprint,
                "started_at": event_record.started_at,
                "ended_at": event_record.ended_at,
                "metadata": event_record.metadata,
                "status": event_record.status,
            }
            return worker_db.save_event(event_data)
        except Exception as e:
            logger.error(f"Failed to persist event: {e}")
            raise

    def _persist_evidence(self, evidence_meta, event_id: str) -> None:
        """Save evidence metadata to database."""
        try:
            evidence_data = {
                "event_id": event_id,
                "evidence_type": "snapshot",
                "file_path": evidence_meta.file_path,
                "file_size": evidence_meta.file_size,
                "mime_type": evidence_meta.mime_type,
                "width": evidence_meta.width,
                "height": evidence_meta.height,
                "metadata": {"timestamp": evidence_meta.timestamp},
            }
            worker_db.save_evidence(evidence_data)
        except Exception as e:
            logger.error(f"Failed to persist evidence: {e}")
            raise

    @property
    def stats(self) -> PipelineMetrics:
        """Get current pipeline statistics."""
        return self._metrics

    @property
    def is_running(self) -> bool:
        return self._running
