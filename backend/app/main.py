"""
PropChain FastAPI Application Main Entrypoint.
Phase 3: Backend Architecture & PostgreSQL Database Foundation.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Any

from fastapi import FastAPI, status

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.database import check_database_connection, close_database_engine, get_session_factory
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.core.middleware import setup_middleware
from app.core.mongo import (
    check_mongo_connection,
    close_mongo_client,
    hydrate_all_from_mongo,
    setup_sqlalchemy_mongo_listener,
    sync_all_to_mongo,
)

# Initialize logging infrastructure before application startup
setup_logging()
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for clean startup and shutdown events."""
    settings = get_settings()
    logger.info("Starting %s (%s environment)...", settings.APP_NAME, settings.APP_ENV)
    logger.info("Target Database: %s", settings.sanitized_database_url)

    # Test database connectivity during startup in non-test environments
    if settings.APP_ENV not in {"test", "testing"}:
        db_ok, msg, _ = check_database_connection()
        if db_ok:
            logger.info("Initial database connection check: CONNECTED")
        else:
            logger.warning("Initial database connection check: %s (Will retry on requests)", msg)

        # Ensure all tables exist in the in-memory engine
        from app.models.base import Base
        from app.core.database import get_engine
        import app.models
        Base.metadata.create_all(bind=get_engine())

        # Hydrate all records directly from MongoDB Atlas as the source of truth
        mongo_ok, mongo_msg, mongo_stats = check_mongo_connection()
        if mongo_ok:
            logger.info("MongoDB Atlas: %s", mongo_msg)
            try:
                session_factory = get_session_factory()
                with session_factory() as session:
                    hydrate_res = hydrate_all_from_mongo(session)
                    logger.info("Hydrated from MongoDB Atlas: %s", hydrate_res)
            except Exception as exc:
                logger.warning("MongoDB hydration notice: %s", exc)
        else:
            logger.warning("MongoDB Atlas connection check: %s", mongo_msg)

        # Setup real-time MongoDB Atlas replication for all mutations
        setup_sqlalchemy_mongo_listener()

    yield

    logger.info("Shutting down %s...", settings.APP_NAME)
    close_database_engine()
    close_mongo_client()
    logger.info("Application shutdown complete.")


def create_application() -> FastAPI:
    """FastAPI application factory with centralized configuration."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        description="PropChain Blockchain Real Estate Platform Backend",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Setup Middleware (Correlation ID, Timing, CORS)
    setup_middleware(app)

    # Register centralized exception handlers
    register_exception_handlers(app)

    # Mount API v1 router
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    # Root metadata endpoint
    @app.get(
        "/",
        tags=["Root"],
        status_code=status.HTTP_200_OK,
        summary="Root API Metadata",
    )
    def read_root() -> Dict[str, Any]:
        """Root API metadata endpoint providing system details and documentation links."""
        return {
            "name": settings.APP_NAME,
            "version": "0.1.0",
            "status": "online",
            "phase": 3,
            "environment": settings.APP_ENV,
            "docs_url": "/docs",
            "redoc_url": "/redoc",
            "api_v1": settings.API_V1_STR,
        }

    # Backward-compatible endpoint for Phase 1 test suite
    @app.get(
        "/api/health",
        tags=["Health"],
        status_code=status.HTTP_200_OK,
        include_in_schema=False,
    )
    def legacy_health_check() -> Dict[str, Any]:
        """Legacy health check for Phase 1 verification compatibility."""
        return {
            "status": "healthy",
            "service": "propchain-backend",
            "phase": 3,
            "environment": settings.APP_ENV,
        }

    return app


app = create_application()
