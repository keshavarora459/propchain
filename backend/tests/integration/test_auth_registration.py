"""
Integration tests for User Registration Endpoint (/api/v1/auth/register).
"""
from fastapi.testclient import TestClient


def test_register_buyer_success(client: TestClient):
    """Verify standard buyer registration succeeds."""
    payload = {
        "full_name": "Alice Buyer",
        "email": "alice.buyer@example.com",
        "phone_number": "+1234567890",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "role": "BUYER",
        "terms_accepted": True,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "alice.buyer@example.com"
    assert data["data"]["role"] == "BUYER"
    assert "password" not in str(data)  # Passwords must never leak


def test_register_duplicate_email_fails(client: TestClient):
    """Verify duplicate email registration is rejected with 400."""
    payload = {
        "full_name": "Bob Buyer",
        "email": "duplicate@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "role": "BUYER",
        "terms_accepted": True,
    }
    # First registration
    resp1 = client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    # Second registration with duplicate email
    resp2 = client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 400
    assert "already exists" in resp2.json()["message"]


def test_register_attempted_admin_role_rejected(client: TestClient):
    """Verify attempting to self-assign ADMIN role is rejected."""
    payload = {
        "full_name": "Sneaky User",
        "email": "sneaky.admin@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "role": "ADMIN",
        "terms_accepted": True,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "Self-registration is only allowed for roles" in str(response.json())


def test_register_attempted_legal_authority_role_rejected(client: TestClient):
    """Verify attempting to self-assign LEGAL_AUTHORITY role is rejected."""
    payload = {
        "full_name": "Unauthorized Authority",
        "email": "unauth.legal@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
        "role": "LEGAL_AUTHORITY",
        "terms_accepted": True,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_register_weak_password_rejected(client: TestClient):
    """Verify weak password is rejected with validation error."""
    payload = {
        "full_name": "Weak Password User",
        "email": "weak@example.com",
        "password": "weak",
        "confirm_password": "weak",
        "role": "BUYER",
        "terms_accepted": True,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


def test_register_password_mismatch_rejected(client: TestClient):
    """Verify non-matching password confirmation is rejected."""
    payload = {
        "full_name": "Mismatch User",
        "email": "mismatch@example.com",
        "password": "SecurePassword123!",
        "confirm_password": "DifferentPassword123!",
        "role": "BUYER",
        "terms_accepted": True,
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "Passwords do not match" in str(response.json())

