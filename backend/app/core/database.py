"""
SQLAlchemy Database Engine, Session Factory, and Health Check for PropChain.
Configures robust connection pooling, lifecycle management, and connection diagnostics.
"""
from typing import Any, Dict, Optional, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, QueuePool, StaticPool

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("database")

# Global engine and sessionmaker references
_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def create_database_engine(database_url: Optional[str] = None) -> Engine:
    """
    Construct a configured SQLAlchemy Engine.
    Applies QueuePool for PostgreSQL, StaticPool/NullPool for SQLite or tests.
    """
    settings = get_settings()
    url = database_url or settings.DATABASE_URL

    # Configure pooling strategy based on dialect
    if url.startswith("sqlite"):
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=settings.DEBUG and settings.is_development,
        )
    else:
        engine = create_engine(
            url,
            connect_args={"connect_timeout": 3},
            poolclass=QueuePool,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_timeout=settings.DATABASE_POOL_TIMEOUT,
            pool_recycle=settings.DATABASE_POOL_RECYCLE,
            pool_pre_ping=True,  # Proactively test connection liveliness before checkout
            echo=False,
        )

    return engine


def get_engine() -> Engine:
    """Return singleton database engine instance."""
    global _engine
    if _engine is None:
        _engine = create_database_engine()
        settings = get_settings()
        logger.info("Initialized SQLAlchemy engine for: %s", settings.sanitized_database_url)
    return _engine


def get_session_factory() -> sessionmaker:
    """Return singleton session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
            expire_on_commit=False,
        )
    return _SessionLocal


def close_database_engine() -> None:
    """Cleanly dispose of all connection pools in the engine on application shutdown."""
    global _engine, _SessionLocal
    if _engine is not None:
        logger.info("Disposing database connection pool...")
        _engine.dispose()
        _engine = None
        _SessionLocal = None
        logger.info("Database engine disposed successfully.")


def check_database_connection() -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Execute a lightweight connectivity probe query (SELECT 1).
    Never exposes raw passwords or secrets in returned diagnostic dict.

    Returns:
        (is_connected: bool, status_message: str, details: Optional[Dict])
    """
    settings = get_settings()
    engine = get_engine()

    try:
        with engine.connect() as conn:
            # Lightweight probe
            conn.execute(text("SELECT 1"))

            # Attempt to retrieve database version info
            version_str = "unknown"
            try:
                version_row = conn.execute(text("SELECT version();")).fetchone()
                if version_row:
                    version_str = str(version_row[0])
            except Exception:
                pass

            details = {
                "target": settings.sanitized_database_url,
                "version": version_str,
                "dialect": engine.dialect.name,
                "driver": engine.dialect.driver,
                "pool_size": getattr(engine.pool, "size", lambda: None)(),
                "checked_in": getattr(engine.pool, "checkedin", lambda: None)(),
                "checked_out": getattr(engine.pool, "checkedout", lambda: None)(),
            }
            return True, "Database connection operational.", details

    except (OperationalError, SQLAlchemyError, Exception) as exc:
        err_msg = str(exc)
        # Redact any passwords that might appear in driver error strings
        if ":" in err_msg and "@" in err_msg:
            settings_obj = get_settings()
            err_msg = err_msg.replace(settings_obj.DATABASE_URL, settings_obj.sanitized_database_url)

        logger.warning("Database connection check failed: %s", err_msg)
        details = {
            "target": settings.sanitized_database_url,
            "error_type": exc.__class__.__name__,
            "diagnostic": "PostgreSQL service is currently unreachable or database does not exist.",
        }
        return False, "Database connection failed.", details
