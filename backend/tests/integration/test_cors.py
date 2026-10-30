"""
Integration tests for CORS, Tracing Headers, and Middleware Pipeline.
"""
from fastapi.testclient import TestClient


def test_cors_preflight_headers(client: TestClient):
    """Verify CORS preflight OPTIONS request returns appropriate headers."""
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "GET" in response.headers.get("access-control-allow-methods", "")


def test_request_correlation_id_and_timing_headers(client: TestClient):
    """Verify middleware injects X-Request-ID and X-Process-Time into responses."""
    custom_request_id = "test-req-12345"
    response = client.get(
        "/api/v1/health",
        headers={"X-Request-ID": custom_request_id},
    )
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID") == custom_request_id
    assert "X-Process-Time" in response.headers
    assert response.headers["X-Process-Time"].endswith("ms")


def test_auto_generated_request_id_when_omitted(client: TestClient):
    """Verify middleware generates a UUID correlation ID when not provided."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    req_id = response.headers.get("X-Request-ID")
    assert req_id is not None
    assert len(req_id) >= 16

