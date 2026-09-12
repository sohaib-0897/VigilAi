import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from vigilai_api.api.v1.router import api_router
from vigilai_api.core.config import get_settings
from vigilai_api.core.exceptions import AuthenticationError, NotFoundError, ValidationError
from vigilai_api.core.redis import redis_manager
from vigilai_api.db.session import async_session_maker

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up VigilAI API...")

    # Check DB Connection
    try:
        async with async_session_maker() as session:
            await session.execute(text("SELECT 1"))
        logger.info("Database connection verified.")
    except Exception as e:
        logger.error(f"Failed to connect to DB: {e}")

    # Connect Redis
    try:
        await redis_manager.connect()
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")

    yield

    # Shutdown
    logger.info("Shutting down VigilAI API...")
    await redis_manager.disconnect()


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

# CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Exception Handlers
@app.exception_handler(AuthenticationError)
async def auth_error_handler(request: Request, exc: AuthenticationError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(NotFoundError)
async def not_found_error_handler(request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": exc.message})


@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=400, content={"detail": exc.message})


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


# Mount evidence/uploads dir
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)
# Uploads are private; only authenticated camera streams expose decoded frames.

# Include Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Optional Prometheus metrics mount
try:
    from prometheus_client import make_asgi_app

    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)
except ImportError:
    pass
