"""VigilAI Core Logging Configuration"""

import logging
import sys

import structlog

from vigilai_api.core.config import get_settings

settings = get_settings()


def setup_logging() -> None:
    """Configure structlog processors and stdlib logging."""
    if settings.ENVIRONMENT.lower() == "production":
        # JSON formatter for production
        processors = [
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Console formatter for development
        processors = [
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S"),
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Configure stdlib logging
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.INFO)
    root_logger.addHandler(handler)

    # Ensure uvicorn logs format similarly if needed, or simply override
    # uvicorn_error = logging.getLogger("uvicorn.error")
    # uvicorn_error.handlers = [handler]


def get_logger(name: str) -> structlog.BoundLogger:
    """Return a structlog logger."""
    return structlog.get_logger(name)
