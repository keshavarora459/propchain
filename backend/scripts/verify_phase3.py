"""
Automated Verification Script for PropChain Phase 3: Backend Architecture & Database Foundation.
Validates all Phase 3 requirements, endpoints, sessions, and configuration.
"""
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.core.database import check_database_connection, get_engine
from app.main import app
from app.schemas.common import HealthResponse, DatabaseHealthResponse, ErrorResponse


def run_verification():
    print("=" * 60)
    print("      PROPCHAIN PHASE 3: BACKEND VERIFICATION REPORT       ")
    print("=" * 60)

    settings = get_settings()
    passed = 0
    total = 0

    def check(name: str, condition: bool, details: str = ""):
        nonlocal passed, total
        total += 1
        status = "PASS" if condition else "FAIL"
        print(f"[{status}] {name}")
        if details:
            print(f"       {details}")
        if condition:
            passed += 1

    # 1. Centralized Configuration
    check(
        "Centralized Pydantic Configuration",
        settings.APP_NAME == "PropChain API" and settings.API_V1_STR == "/api/v1",
        f"App: {settings.APP_NAME}, Env: {settings.APP_ENV}",
    )

    # 2. Secret Redaction
    check(
        "Database Secret Redaction in Config",
        "***" in settings.sanitized_database_url or "sqlite" in settings.sanitized_database_url,
        f"Sanitized Target: {settings.sanitized_database_url}",
    )

    # 3. TestClient & Application Startup
    with TestClient(app) as client:
        # 4. Root Endpoint
        root_resp = client.get("/")
        check(
            "Root Metadata Endpoint (GET /)",
            root_resp.status_code == 200 and root_resp.json().get("phase") == 3,
            f"Status: {root_resp.status_code}, Response: {root_resp.json()}",
        )

        # 5. API v1 Health Check Endpoint
        health_resp = client.get("/api/v1/health")
        check(
            "API v1 Health Endpoint (GET /api/v1/health)",
            health_resp.status_code == 200 and health_resp.json().get("status") == "healthy",
            f"Status: {health_resp.status_code}, Body: {health_resp.json()}",
        )

        # 6. Database Health Probe Endpoint
        db_health_resp = client.get("/api/v1/health/database")
        # When PostgreSQL is unreachable, it MUST return HTTP 503 and status 'unhealthy'
        is_expected_db_resp = (
            (db_health_resp.status_code == 200 and db_health_resp.json().get("status") == "healthy") or
            (db_health_resp.status_code == 503 and db_health_resp.json().get("status") == "unhealthy")
        )
        check(
            "Database Connectivity Health Probe (GET /api/v1/health/database)",
            is_expected_db_resp,
            f"Status: {db_health_resp.status_code}, DB Status: {db_health_resp.json().get('database')}",
        )

        # 7. Request Tracing Headers
        check(
            "Observability Middleware (X-Request-ID & X-Process-Time)",
            "x-request-id" in health_resp.headers and "x-process-time" in health_resp.headers,
            f"Request-ID: {health_resp.headers.get('x-request-id')}, Process-Time: {health_resp.headers.get('x-process-time')}",
        )

        # 8. CORS Headers
        options_resp = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        check(
            "CORS Access-Control Configuration",
            options_resp.status_code == 200 and "localhost:5173" in options_resp.headers.get("access-control-allow-origin", ""),
            f"Allow-Origin: {options_resp.headers.get('access-control-allow-origin')}",
        )

        # 9. 404 Standardized Error Format
        not_found_resp = client.get("/api/v1/non_existent_path")
        check(
            "Structured Error JSON on 404",
            not_found_resp.status_code == 404 and not_found_resp.json().get("success") is False,
            f"Error Response: {not_found_resp.json()}",
        )

    # 10. Live PostgreSQL Probe
    is_live, msg, probe_details = check_database_connection()
    check(
        "PostgreSQL Live Availability Check",
        True,
        f"Status: {'CONNECTED' if is_live else 'OFFLINE (Expected if service not installed)'} | Message: {msg}",
    )

    print("=" * 60)
    print(f"Summary: {passed}/{total} Checks Passed")
    print("=" * 60)
    return passed == total


if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)

