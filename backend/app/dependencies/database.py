"""
FastAPI Database Session Dependency for PropChain.
Provides per-request isolated SQLAlchemy sessions with automatic transaction cleanup.
"""
from typing import Generator
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.database import get_session_factory
from app.core.logging import get_logger
from app.core.mongo import sync_from_mongo_if_stale

logger = get_logger("dependencies.database")


def get_db() -> Generator[Session, None, None]:
    """
    Provide a scoped database session per request.
    Synchronizes stale MongoDB state before opening the session and rolls back on exception.
    """
    settings = get_settings()
    if settings.APP_ENV not in {"test", "testing"}:
        try:
            sync_from_mongo_if_stale()
        except Exception as sync_exc:
            logger.debug("Pre-request MongoDB sync skipped: %s", sync_exc)

    session_factory = get_session_factory()
    session: Session = session_factory()
    try:
        yield session
    except SQLAlchemyError as exc:
        logger.error("Database error during request session execution: %s", exc)
        session.rollback()
        raise
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

