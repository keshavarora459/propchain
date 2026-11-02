"""
Integration Tests for PropChain Role-Based Access Control (RBAC) and Role Dashboards.
Tests all 5 roles:
1. BUYER
2. PROPERTY_OWNER (Seller)
3. VERIFIER (Agent)
4. LEGAL_AUTHORITY (Registrar)
5. ADMIN (System Admin)

Verifies:
- Authenticated login returns the user's role and valid JWT token
- /api/v1/users/me returns the authenticated user's role
- /api/v1/analytics/dashboard returns tailored telemetry matching the caller's role
- Unauthorized endpoints return HTTP 403 Forbidden
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import UserRole, AccountStatus
from app.core.security import hash_password
from app.models.user import User

DEMO_USERS = [
    {
        "role_enum": UserRole.BUYER,
        "email": "buyer.test@propchain.network",
        "full_name": "Bob Buyer Test",
        "expected_role": "BUYER",
        "expected_metric_key": "buyer_metrics",
    },
    {
        "role_enum": UserRole.PROPERTY_OWNER,
        "email": "seller.test@propchain.network",
        "full_name": "Alice Seller Test",
        "expected_role": "PROPERTY_OWNER",
        "expected_metric_key": "seller_metrics",
    },
    {
        "role_enum": UserRole.VERIFIER,
        "email": "verifier.test@propchain.network",
        "full_name": "Senior Verifier Test",
        "expected_role": "VERIFIER",
        "expected_metric_key": "verifier_metrics",
    },
    {
        "role_enum": UserRole.LEGAL_AUTHORITY,
        "email": "legal.test@propchain.network",
        "full_name": "Chief Registrar Test",
        "expected_role": "LEGAL_AUTHORITY",
        "expected_metric_key": "legal_metrics",
    },
    {
        "role_enum": UserRole.ADMIN,
        "email": "admin.test@propchain.network",
        "full_name": "SysAdmin Test",
        "expected_role": "ADMIN",
        "expected_metric_key": "admin_metrics",
    },
]

TEST_PASSWORD = "Password123!"


@pytest.fixture(autouse=True)
def seed_test_users(db_session: Session):
    """Seed test users for each role in the isolated test database."""
    hashed = hash_password(TEST_PASSWORD)
    for u in DEMO_USERS:
        existing = db_session.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                full_name=u["full_name"],
                email=u["email"],
                password_hash=hashed,
                role=u["role_enum"].value,
                account_status=AccountStatus.ACTIVE.value,
                email_verified=True,
            )
            db_session.add(user)
    db_session.commit()


def test_login_and_role_persistence(client: TestClient):
    """Verify that every role authenticates and retrieves its correct role."""
    for user_info in DEMO_USERS:
        res = client.post(
            "/api/v1/auth/login",
            json={"email": user_info["email"], "password": TEST_PASSWORD},
        )
        assert res.status_code == 200, f"Login failed for {user_info['email']}: {res.text}"
        data = res.json()
        token = data["access_token"]
        assert data["user"]["role"] == user_info["expected_role"]

        # Verify /users/me endpoint persists and returns role
        me_res = client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        me_data = me_res.json()
        assert me_data["role"] == user_info["expected_role"]


def test_role_tailored_dashboard_telemetry(client: TestClient):
    """Verify each role gets its dedicated telemetry metrics from /analytics/dashboard."""
    for user_info in DEMO_USERS:
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": user_info["email"], "password": TEST_PASSWORD},
        )
        token = login_res.json()["access_token"]

        dash_res = client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        metric_key = user_info["expected_metric_key"]
        assert metric_key in dash_data, f"Expected {metric_key} in dashboard for {user_info['role_enum'].value}"
        assert dash_data[metric_key] is not None


def test_rbac_boundary_forbidden_access(client: TestClient):
    """Verify that unauthorized users cannot execute restricted operations (HTTP 403)."""
    # 1. Buyer token
    buyer_login = client.post(
        "/api/v1/auth/login",
        json={"email": "buyer.test@propchain.network", "password": TEST_PASSWORD},
    )
    buyer_token = buyer_login.json()["access_token"]

    # Buyer attempting to verify a document must return 403 Forbidden
    verify_res = client.post(
        "/api/v1/documents/fake-doc-id/verify",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert verify_res.status_code == 403, f"Expected 403 for Buyer verifying document, got {verify_res.status_code}"

    # Buyer attempting to confirm statutory legal registration must return 403 Forbidden
    confirm_res = client.post(
        "/api/v1/transactions/fake-tx-id/legal-confirm",
        json={"notes": "statutory confirmation"},
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert confirm_res.status_code == 403, f"Expected 403 for Buyer legal confirmation, got {confirm_res.status_code}"

    # 2. Seller token
    seller_login = client.post(
        "/api/v1/auth/login",
        json={"email": "seller.test@propchain.network", "password": TEST_PASSWORD},
    )
    seller_token = seller_login.json()["access_token"]

    # Seller attempting to reject document must return 403 Forbidden
    seller_reject_res = client.post(
        "/api/v1/documents/fake-doc-id/reject",
        headers={"Authorization": f"Bearer {seller_token}"},
    )
    assert seller_reject_res.status_code == 403, f"Expected 403 for Seller rejecting document, got {seller_reject_res.status_code}"

    # 3. Admin cannot bypass statutory legal registration confirmation
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin.test@propchain.network", "password": TEST_PASSWORD},
    )
    admin_token = admin_login.json()["access_token"]

    admin_confirm_res = client.post(
        "/api/v1/transactions/fake-tx-id/legal-confirm",
        json={"notes": "admin attempting legal confirmation"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_confirm_res.status_code == 403, f"Admin must NOT be able to execute legal registration, got {admin_confirm_res.status_code}"
