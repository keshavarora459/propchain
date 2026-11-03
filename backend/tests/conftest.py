"""
Pytest Fixtures and Test Configuration for PropChain Backend.
Provides test isolation and mocks for database sessions and test client.
"""
import os
import sys
import uuid
from typing import Generator
import pytest

# Ensure backend directory is first in sys.path and remove conflicting foreign paths
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
sys.path = [p for p in sys.path if "payroll" not in p]

# Force test environment and disable MongoDB Atlas
os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "true"
os.environ["MONGO_URI"] = ""

from app.core.config import Settings, get_settings
get_settings.cache_clear()

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_engine, get_session_factory
from app.dependencies.database import get_db
from app.main import app
from app.models.base import Base


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Return application settings configured for test execution."""
    return get_settings()


@pytest.fixture(scope="session")
def test_engine():
    """Create an isolated in-memory SQLite database engine for test transactions."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(test_engine) -> Generator[Session, None, None]:
    """Provide an isolated, transactional database session that rolls back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    test_session_factory = sessionmaker(
        bind=connection,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    session = test_session_factory()

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide FastAPI TestClient with overridden database session dependency."""
    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
