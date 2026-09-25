try:
    from prometheus_client import Counter, Gauge, Histogram, start_http_server

    FRAMES_RECEIVED = Counter(
        "vigilai_frames_received_total", "Total frames received", ["camera_id"]
    )
    FRAMES_PROCESSED = Counter(
        "vigilai_frames_processed_total", "Total frames processed", ["camera_id"]
    )
    FRAMES_DROPPED = Counter("vigilai_frames_dropped_total", "Total frames dropped", ["camera_id"])
    INFERENCE_LATENCY = Histogram(
        "vigilai_inference_latency_seconds", "Inference latency", ["camera_id"]
    )
    ACTIVE_CAMERAS = Gauge("vigilai_active_cameras", "Number of active camera pipelines")
    EVENTS_TOTAL = Counter(
        "vigilai_events_total", "Total events generated", ["camera_id", "event_type"]
    )
    PIPELINE_ERRORS = Counter(
        "vigilai_pipeline_errors_total", "Total pipeline errors", ["camera_id"]
    )

    PROM_AVAILABLE = True
except ImportError:
    PROM_AVAILABLE = False
    start_http_server = None
