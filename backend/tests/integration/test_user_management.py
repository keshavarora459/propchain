"""
Integration tests for User Profile, RBAC Authorization, and Admin User Management.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import AccountStatus, UserRole
from app.repositories.user_repository import user_repository


def _create_authenticated_user(client: TestClient, db_session: Session, email: str, role: UserRole = UserRole.BUYER):
    """Helper to provision a user with specific role and return access token and user record."""
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": f"User {role.value}",
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )
    user = user_repository.get_by_email(db_session, email)
    if role != UserRole.BUYER:
        user_repository.update_user(db_session, user, role=role.value)

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]
    return token, user


def test_get_and_update_my_profile(client: TestClient, db_session: Session):
    """Verify authenticated user can fetch and update their own profile."""
    token, user = _create_authenticated_user(client, db_session, "profile.test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch profile
    get_resp = client.get("/api/v1/users/me", headers=headers)
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["email"] == "profile.test@example.com"
    assert "view_dashboard" in data["permissions"]

    # Update profile
    patch_resp = client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={"full_name": "Updated Name", "phone_number": "+987654321"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["full_name"] == "Updated Name"


def test_admin_user_listing_authorization(client: TestClient, db_session: Session):
    """Verify only ADMIN role can list all platform users; BUYER receives 403."""
    buyer_token, _ = _create_authenticated_user(client, db_session, "buyer.listing@example.com", UserRole.BUYER)
    admin_token, _ = _create_authenticated_user(client, db_session, "admin.listing@example.com", UserRole.ADMIN)

    # Buyer attempt should receive 403 Forbidden
    buyer_attempt = client.get("/api/v1/users", headers={"Authorization": f"Bearer {buyer_token}"})
    assert buyer_attempt.status_code == 403

    # Admin attempt succeeds
    admin_attempt = client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_attempt.status_code == 200
    assert "users" in admin_attempt.json()
    assert admin_attempt.json()["total"] >= 2


def test_admin_update_account_status_and_session_invalidation(client: TestClient, db_session: Session):
    """Verify admin can suspend a user account and ensure suspended user cannot make requests."""
    target_token, target_user = _create_authenticated_user(
        client, db_session, "target.suspend@example.com", UserRole.BUYER
    )
    admin_token, _ = _create_authenticated_user(client, db_session, "admin.status@example.com", UserRole.ADMIN)

    # Admin suspends target user
    suspend_resp = client.patch(
        f"/api/v1/users/{target_user.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"account_status": "SUSPENDED"},
    )
    assert suspend_resp.status_code == 200
    assert suspend_resp.json()["data"]["account_status"] == "SUSPENDED"

    # Suspended user's subsequent requests are blocked with 403
    blocked_resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {target_token}"})
    assert blocked_resp.status_code == 403
    assert "suspended" in blocked_resp.json()["message"].lower()


def test_user_detail_cross_access_restriction(client: TestClient, db_session: Session):
    """Verify ordinary users cannot view other users' records."""
    token_a, user_a = _create_authenticated_user(client, db_session, "user.a@example.com")
    _, user_b = _create_authenticated_user(client, db_session, "user.b@example.com")

    # User A tries to view User B
    resp = client.get(f"/api/v1/users/{user_b.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 403

