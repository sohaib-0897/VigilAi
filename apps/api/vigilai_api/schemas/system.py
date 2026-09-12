from pydantic import BaseModel


class SystemHealth(BaseModel):
    status: str
    version: str
    details: dict[str, str]


class SystemMetrics(BaseModel):
    cpu_usage_percent: float | None = None
    memory_usage_percent: float | None = None
    active_streams: int | None = None
    events_per_minute: float | None = None
    workers: int = 0


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    workers: int
    uptime: float


class MetricsResponse(BaseModel):
    system_cpu: float
    system_memory: float
    gpu_utilization: float
    processed_frames: int
    active_streams: int
    queue_size: int
