"""
Foundation verification tests for PropChain Backend.
Tests the FastAPI application and health-check endpoint.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify root endpoint responds with status 200 and expected metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "PropChain API"
    assert data["status"] == "online"
    assert data["phase"] >= 1


def test_health_check_endpoint():
    """Verify health endpoint responds with status 200 and healthy status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "propchain-backend"
    assert data["phase"] >= 1

