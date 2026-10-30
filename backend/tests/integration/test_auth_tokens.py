"""
Integration tests for Refresh Token Rotation, Reuse Detection, and Session Revocation.
"""
from fastapi.testclient import TestClient


def test_refresh_token_rotation_and_revocation(client: TestClient):
    """Verify refresh token rotation successfully issues new tokens and revokes previous one."""
    email = "token.rotation@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Rotation User",
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )

    # Initial login
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    first_refresh = login_resp.json()["refresh_token"]

    # First refresh operation
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh},
    )
    assert refresh_resp.status_code == 200
    second_refresh = refresh_resp.json()["refresh_token"]
    assert second_refresh != first_refresh


def test_refresh_token_reuse_detection_terminates_sessions(client: TestClient):
    """Verify that reusing a revoked refresh token triggers theft detection and invalidates all sessions."""
    email = "reuse.detection@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Reuse Test User",
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    first_refresh = login_resp.json()["refresh_token"]

    # Rotate the token once (first_refresh is now revoked and replaced)
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh},
    )
    assert refresh_resp.status_code == 200
    second_refresh = refresh_resp.json()["refresh_token"]

    # Attacker or replay attempts to reuse the already-revoked first_refresh!
    reuse_attempt = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh},
    )
    assert reuse_attempt.status_code == 401
    assert "reuse detected" in reuse_attempt.json()["message"].lower()

    # Now verify that even second_refresh was revoked due to the security alarm
    subsequent_attempt = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second_refresh},
    )
    assert subsequent_attempt.status_code == 401


def test_logout_invalidates_session(client: TestClient):
    """Verify logging out revokes the refresh token."""
    email = "logout.test@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Logout User",
            "email": email,
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    # Logout
    logout_resp = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Attempt to refresh with logged-out token
    failed_refresh = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert failed_refresh.status_code == 401


def test_change_password_flow_and_session_revocation(client: TestClient):
    """Verify password change verifies current password, updates hash, and terminates old sessions."""
    email = "changepw.test@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "ChangePw User",
            "email": email,
            "password": "OldPassword123!",
            "confirm_password": "OldPassword123!",
            "role": "BUYER",
            "terms_accepted": True,
        },
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "OldPassword123!"},
    )
    access_token = login_resp.json()["access_token"]
    old_refresh = login_resp.json()["refresh_token"]

    # Wrong current password fails
    bad_req = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "current_password": "WrongOldPassword!",
            "new_password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        },
    )
    assert bad_req.status_code == 401

    # Valid change password
    change_resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "current_password": "OldPassword123!",
            "new_password": "BrandNewPassword123!",
            "confirm_password": "BrandNewPassword123!",
        },
    )
    assert change_resp.status_code == 200

    # Old refresh token should now be invalidated
    old_refresh_attempt = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert old_refresh_attempt.status_code == 401

    # Login with new password succeeds
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "BrandNewPassword123!"},
    )
    assert new_login.status_code == 200

