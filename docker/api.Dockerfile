# VigilAI — Backend API Dockerfile
FROM python:3.12-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r vigilai && useradd -r -g vigilai -d /app -s /sbin/nologin vigilai

WORKDIR /app

# Copy requirements first for better caching
COPY pyproject.toml ./
COPY apps/api/ ./apps/api/
COPY apps/worker/ ./apps/worker/
RUN --mount=type=cache,target=/root/.cache/pip \
    PIP_NO_CACHE_DIR=0 pip install --timeout 180 torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    PIP_NO_CACHE_DIR=0 pip install --timeout 180 .

# Copy application code
COPY apps/api/ ./apps/api/
COPY alembic.ini ./
COPY scripts/ ./scripts/

# Create necessary directories
RUN mkdir -p /app/evidence /app/uploads /app/models /app/data \
    && chown -R vigilai:vigilai /app

# Switch to non-root user
USER vigilai

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/system/health || exit 1

# Run the API server
CMD ["sh", "-c", "python -m alembic upgrade head && python -m uvicorn vigilai_api.main:app --host 0.0.0.0 --port 8000"]
