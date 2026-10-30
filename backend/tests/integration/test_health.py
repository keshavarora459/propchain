"""
Integration tests for PropChain Health and Root Endpoints.
"""
from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """Verify root endpoint returns system information, phase 3 indicator, and status 200."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "PropChain API"
    assert data["status"] == "online"
    assert data["phase"] == 3
    assert data["docs_url"] == "/docs"
    assert data["api_v1"] == "/api/v1"


def test_api_v1_health_endpoint(client: TestClient):
    """Verify API v1 health endpoint reports healthy service status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "PropChain API"
    assert "timestamp" in data


def test_legacy_health_check_endpoint(client: TestClient):
    """Verify legacy health check remains compatible for Phase 1 validation script."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "propchain-backend"


def test_invalid_route_returns_404_json(client: TestClient):
    """Verify non-existent route returns clean JSON error response."""
    response = client.get("/api/v1/non_existent_route")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert "error" in data
    assert "message" in data

