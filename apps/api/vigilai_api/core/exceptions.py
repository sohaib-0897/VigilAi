"""VigilAI Custom Exceptions"""

from fastapi import Request
from fastapi.responses import JSONResponse


class VigilAIError(Exception):
    """Base exception for VigilAI errors"""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(VigilAIError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class AuthenticationError(VigilAIError):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


class AuthorizationError(VigilAIError):
    def __init__(self, message: str = "Not authorized to perform this action"):
        super().__init__(message, status_code=403)


class ValidationError(VigilAIError):
    def __init__(self, message: str = "Validation error"):
        super().__init__(message, status_code=400)


class ConflictError(VigilAIError):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, status_code=409)


class ExternalServiceError(VigilAIError):
    def __init__(self, message: str = "External service error"):
        super().__init__(message, status_code=502)


class StorageError(VigilAIError):
    def __init__(self, message: str = "Storage error"):
        super().__init__(message, status_code=500)


async def vigilai_exception_handler(request: Request, exc: VigilAIError) -> JSONResponse:
    """FastAPI exception handler for custom errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.__class__.__name__, "detail": exc.message},
    )
