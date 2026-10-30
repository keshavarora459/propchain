"""
Centralized Exception Handling and Error Formatting for PropChain.
Standardizes API error responses and safeguards against secret leakage.
"""
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.common import ErrorDetail, ErrorResponse

logger = get_logger("exceptions")


# Custom application domain exceptions
class PropChainException(Exception):
    """Base exception for all application-level errors."""
    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class DatabaseConnectionException(PropChainException):
    """Raised when the database is unreachable."""
    def __init__(self, message: str = "Database connection is currently unavailable."):
        super().__init__(message=message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


class ResourceNotFoundException(PropChainException):
    """Raised when a requested resource is not found."""
    def __init__(self, message: str = "Requested resource was not found."):
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND)


class ValidationException(PropChainException):
    """Raised for custom validation failures."""
    def __init__(self, message: str = "Validation failed.", details: Optional[List[ErrorDetail]] = None):
        super().__init__(message=message, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
        self.details = details or []


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the FastAPI application."""
    from app.core.security import AuthenticationError

    @app.exception_handler(AuthenticationError)
    async def authentication_error_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
        logger.warning(
            "Authentication failure on %s %s: [%d] %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.message,
        )
        response_model = ErrorResponse(
            error=exc.__class__.__name__,
            message=exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=response_model.model_dump(mode="json"),
        )

    @app.exception_handler(PropChainException)
    async def propchain_exception_handler(request: Request, exc: PropChainException) -> JSONResponse:
        logger.warning(
            "PropChain exception on %s %s: [%d] %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.message,
        )
        response_model = ErrorResponse(
            error=exc.__class__.__name__,
            message=exc.message,
            details=getattr(exc, "details", None),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=response_model.model_dump(mode="json"),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
        details: List[ErrorDetail] = []
        for error in exc.errors():
            field_name = ".".join(str(loc) for loc in error.get("loc", []) if loc != "body")
            details.append(
                ErrorDetail(
                    code=error.get("type", "value_error"),
                    message=error.get("msg", "Invalid value"),
                    field=field_name or None,
                )
            )

        response_model = ErrorResponse(
            error="ValidationError",
            message="Request input validation failed. Please check the supplied parameters.",
            details=details,
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=response_model.model_dump(mode="json"),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        logger.info("HTTPException %d on %s %s: %s", exc.status_code, request.method, request.url.path, exc.detail)
        response_model = ErrorResponse(
            error=f"HTTP_{exc.status_code}",
            message=str(exc.detail) if exc.detail else "An HTTP error occurred.",
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=response_model.model_dump(mode="json"),
        )

    @app.exception_handler(OperationalError)
    async def database_operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
        logger.error("Database operational connection failure: %s", exc)
        response_model = ErrorResponse(
            error="DatabaseConnectionError",
            message="Database connection error. The service is unable to reach the database.",
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=response_model.model_dump(mode="json"),
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        logger.error("SQLAlchemy error occurred: %s", exc)
        response_model = ErrorResponse(
            error="DatabaseError",
            message="A database operation error occurred.",
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_model.model_dump(mode="json"),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc)
        settings = get_settings()

        # In development, provide safe diagnostic message; in production, keep generic
        message = (
            f"Internal server error: {exc.__class__.__name__}"
            if settings.is_development
            else "An unexpected internal server error occurred."
        )

        response_model = ErrorResponse(
            error="InternalServerError",
            message=message,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=response_model.model_dump(mode="json"),
        )

