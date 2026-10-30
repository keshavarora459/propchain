"""
FastAPI Database Session Dependency for PropChain.
Provides per-request isolated SQLAlchemy sessions with automatic transaction cleanup.
"""
from typing import Generator
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_session_factory
from app.core.logging import get_logger

logger = get_logger("dependencies.database")


def get_db() -> Generator[Session, None, None]:
    """
    Provide a scoped database session per request.
    Rolls back uncommitted changes on exception and guarantees session closure.
    """
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

