"""
Integration tests for User Authentication and Login Rate-Limiting.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import AccountStatus
from app.repositories.user_repository import user_repository


def test_login_successful_flow(client: TestClient):
    """Verify authenticating with valid credentials returns tokens and sets cookie."""
    # First, register an active account
    register_payload = {
        "full_name": "Test Login User",
        "email": "login.test@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "role": "BUYER",
        "terms_accepted": True,
    }
    client.post("/api/v1/auth/register", json=register_payload)

    # Perform login
    login_payload = {
        "email": "login.test@example.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "login.test@example.com"
    # Verify HTTP-only refresh cookie
    assert "propchain_refresh_token" in response.headers.get("set-cookie", "")


def test_login_wrong_password_rejected(client: TestClient):
    """Verify incorrect password returns generic 401."""
    login_payload = {
        "email": "login.test@example.com",
        "password": "WrongPassword123!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["message"]


def test_login_unknown_email_rejected_with_identical_generic_message(client: TestClient):
    """Verify non-existent email returns identical generic 401 to prevent enumeration."""
    login_payload = {
        "email": "nonexistent.user.123456@example.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["message"]


def test_login_suspended_account_rejected(client: TestClient, db_session: Session):
    """Verify suspended accounts cannot authenticate."""
    email = "suspended.user@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Suspended User",
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )
    user = user_repository.get_by_email(db_session, email)
    user_repository.update_user(db_session, user, account_status=AccountStatus.SUSPENDED.value)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert response.status_code == 403
    assert "suspended" in response.json()["message"].lower()


def test_login_rate_limiting_lockout(client: TestClient):
    """Verify consecutive failed login attempts trigger 429 lockout."""
    target_email = "bruteforce.target@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Target User",
            "email": target_email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )

    # Trigger 5 failed login attempts
    for _ in range(5):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": target_email, "password": "WrongPassword!"},
        )
        assert resp.status_code == 401

    # 6th attempt should be blocked by rate-limiting with 429 Too Many Requests
    locked_resp = client.post(
        "/api/v1/auth/login",
        json={"email": target_email, "password": "Password123!"},
    )
    assert locked_resp.status_code == 429
    assert "locked" in locked_resp.json()["message"].lower()

