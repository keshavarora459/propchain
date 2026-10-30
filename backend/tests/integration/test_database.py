"""
Integration tests for Database Connectivity, Health Probes, and Session Lifecycle.
"""
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import database as db_module
from app.dependencies.database import get_db


def test_database_health_endpoint_success(client: TestClient):
    """Verify database health endpoint reports connected when probe succeeds."""
    mock_details = {"target": "postgresql+psycopg://postgres:***@localhost:5432/propchain", "dialect": "postgresql"}
    with patch("app.api.v1.endpoints.health.check_database_connection", return_value=(True, "Operational", mock_details)):
        response = client.get("/api/v1/health/database")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert data["details"]["dialect"] == "postgresql"


def test_database_health_endpoint_failure(client: TestClient):
    """Verify database health endpoint reports 503 and disconnected when probe fails."""
    mock_details = {"target": "postgresql+psycopg://postgres:***@localhost:5432/propchain", "error_type": "OperationalError"}
    with patch("app.api.v1.endpoints.health.check_database_connection", return_value=(False, "Failed", mock_details)):
        response = client.get("/api/v1/health/database")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "target" in data["details"]
        # Ensure password is never present
        assert "supersecret" not in str(data)


def test_database_session_execution_and_rollback(db_session: Session):
    """Verify session can execute statements and handle rollback cleanly."""
    # Execute query using the session
    result = db_session.execute(text("SELECT 42 AS value")).scalar()
    assert result == 42

    # Verify rollback operates without error
    db_session.rollback()


def test_get_db_generator_cleanup(test_engine):
    """Verify get_db generator yields active session and closes it cleanly."""
    with patch.object(db_module, "get_engine", return_value=test_engine):
        gen = get_db()
        session = next(gen)
        assert isinstance(session, Session)
        assert session.is_active

        # Close generator and ensure cleanup
        with pytest.raises(StopIteration):
            next(gen)
