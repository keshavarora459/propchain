"""
Health Check and System Diagnostics Endpoints for PropChain API v1.
"""
from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.database import check_database_connection
from app.schemas.common import DatabaseHealthResponse, HealthResponse

router = APIRouter()


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Application Health Probe",
    description="Reports the operational status of the PropChain FastAPI service.",
)
async def get_application_health() -> HealthResponse:
    """Check API application health status."""
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        service=settings.APP_NAME,
        environment=settings.APP_ENV,
        version="0.1.0",
    )


@router.get(
    "/database",
    response_model=DatabaseHealthResponse,
    summary="Database Connectivity Probe",
    description="Executes a live lightweight probe against the configured PostgreSQL database.",
    responses={
        200: {
            "description": "PostgreSQL database connected and operational.",
            "model": DatabaseHealthResponse,
        },
        503: {
            "description": "Database connection failed or PostgreSQL service unavailable.",
            "model": DatabaseHealthResponse,
        },
    },
)
async def get_database_health(response: Response) -> DatabaseHealthResponse:
    """
    Execute real database query (SELECT 1).
    Returns HTTP 200 if connected, HTTP 503 if unavailable.
    Never exposes database passwords in the response.
    """
    is_connected, message, details = check_database_connection()

    if not is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return DatabaseHealthResponse(
            status="unhealthy",
            database="disconnected",
            details=details,
        )

    return DatabaseHealthResponse(
        status="healthy",
        database="connected",
        details=details,
    )


@router.get(
    "/mongodb",
    summary="MongoDB Atlas Connectivity Probe",
    description="Inspects real-time connection status and document counts in MongoDB Atlas.",
)
async def get_mongodb_health(response: Response):
    from app.core.mongo import check_mongo_connection

    is_connected, message, details = check_mongo_connection()
    if not is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unhealthy",
            "mongodb": "disconnected",
            "message": message,
        }

    return {
        "status": "healthy",
        "mongodb": "connected",
        "message": message,
        "details": details,
    }

