"""
HTTP Middleware for PropChain FastAPI Application.
Provides request correlation IDs, latency profiling, request logging, and CORS setup.
"""
import time
import uuid
from typing import Callable
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("middleware")


class RequestTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that attaches correlation ID, records latency,
    and logs request metrics for observability.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        # Extract or generate correlation ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        # Process the request
        try:
            response: Response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(
                "Request failed: %s %s [%.2f ms] (Request-ID: %s)",
                request.method,
                request.url.path,
                duration_ms,
                request_id,
            )
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Inject tracing headers into response
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"

        # Log request summary
        logger.info(
            "%s %s -> %d [%.2f ms] (Request-ID: %s)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )

        return response


def setup_middleware(app: FastAPI) -> None:
    """Register all middleware on the application."""
    settings = get_settings()

    # Correlation ID & Timing Middleware
    app.add_middleware(RequestTrackingMiddleware)

    # CORS Middleware with strict origin control
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "Accept",
            "X-Request-ID",
            "X-Requested-With",
        ],
        expose_headers=["X-Request-ID", "X-Process-Time"],
        max_age=600,
    )
    logger.info("Configured CORS allowed origins: %s", settings.cors_origins)

