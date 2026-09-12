# VigilAI — Worker Dockerfile
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies (OpenCV needs these)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r vigilai && useradd -r -g vigilai -d /app -s /sbin/nologin vigilai

WORKDIR /app

# Copy requirements first
COPY pyproject.toml ./
COPY apps/api/ ./apps/api/
COPY apps/worker/ ./apps/worker/
RUN pip install --no-cache-dir .

# Copy application code (worker needs both worker and shared api modules)
COPY apps/ ./apps/
COPY alembic.ini ./

# Create necessary directories
RUN mkdir -p /app/evidence /app/uploads /app/models /app/data \
    && chown -R vigilai:vigilai /app

USER vigilai

# Health check via Redis heartbeat (no HTTP server in worker)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import redis; import os; r=redis.from_url(os.environ['REDIS_URL']); assert r.exists('worker:' + os.environ.get('WORKER_ID', 'worker-1') + ':status')" || exit 1

CMD ["python", "-m", "apps.worker.main"]
