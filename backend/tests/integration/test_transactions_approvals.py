"""
Integration tests for Real Estate Transactions, Approvals, and Legal Registration in PropChain.
Tests complete 13-state conveyance workflow: Buyer proposal, Seller acceptance/rejection,
Verifier approval, Legal Authority restriction (Admin forbidden), and final blockchain transfer.
"""
import uuid
from datetime import date
import pytest
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.models.user import User


@pytest.fixture
def owner_user(db_session) -> User:
    email = f"owner_tx_{uuid.uuid4().hex[:8]}@example.com"
    owner = User(
        full_name="Deed Seller",
        email=email,
        password_hash=hash_password("StrongPassword!123"),
        role="PROPERTY_OWNER",
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(owner)
    db_session.commit()
    return owner


@pytest.fixture
def buyer_user(db_session) -> User:
    email = f"buyer_tx_{uuid.uuid4().hex[:8]}@example.com"
    buyer = User(
        full_name="Escrow Buyer",
        email=email,
        password_hash=hash_password("StrongPassword!123"),
        role="BUYER",
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(buyer)
    db_session.commit()
    return buyer


@pytest.fixture
def verifier_user(db_session) -> User:
    email = f"verifier_tx_{uuid.uuid4().hex[:8]}@example.com"
    verifier = User(
        full_name="Title Verifier",
        email=email,
        password_hash=hash_password("StrongPassword!123"),
        role="VERIFIER",
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(verifier)
    db_session.commit()
    return verifier


@pytest.fixture
def legal_authority_user(db_session) -> User:
    email = f"legal_tx_{uuid.uuid4().hex[:8]}@example.com"
    legal = User(
        full_name="Sub-Registrar Officer",
        email=email,
        password_hash=hash_password("StrongPassword!123"),
        role="LEGAL_AUTHORITY",
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(legal)
    db_session.commit()
    return legal


@pytest.fixture
def admin_user(db_session) -> User:
    email = f"admin_tx_{uuid.uuid4().hex[:8]}@example.com"
    admin = User(
        full_name="System Administrator",
        email=email,
        password_hash=hash_password("StrongPassword!123"),
        role="ADMIN",
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


def _get_token(client: TestClient, user: User) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "StrongPassword!123"},
    )
    return res.json()["access_token"]


def test_complete_transaction_conveyance_lifecycle(
    client: TestClient,
    owner_user: User,
    buyer_user: User,
    verifier_user: User,
    legal_authority_user: User,
    admin_user: User,
):
    owner_token = _get_token(client, owner_user)
    buyer_token = _get_token(client, buyer_user)
    verifier_token = _get_token(client, verifier_user)
    legal_token = _get_token(client, legal_authority_user)
    admin_token = _get_token(client, admin_user)

    # 1. Owner registers a property
    prop_payload = {
        "title": "Seaside Luxury Penthouse",
        "property_type": "RESIDENTIAL",
        "country": "India",
        "state": "Goa",
        "city": "Panaji",
        "street_address": "10 Miramar Beach Road",
        "postal_code": "403001",
        "land_area": 4000.0,
        "survey_number": f"SURV-TX-{uuid.uuid4().hex[:6]}",
        "registration_number": f"REG-TX-{uuid.uuid4().hex[:6]}",
    }
    prop = client.post(
        "/api/v1/properties",
        json=prop_payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()
    prop_id = prop["id"]

    # Verifier marks property verified so buyer can initiate offer
    v_res = client.patch(
        f"/api/v1/properties/{prop_id}/status",
        headers={"Authorization": f"Bearer {verifier_token}"},
        json={"verification_status": "VERIFIED"},
    )
    assert v_res.status_code == 200

    # 2. Buyer initiates transaction
    txn_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "property_id": prop_id,
            "proposed_amount": 25000000.00,
            "currency": "INR",
            "transaction_type": "SALE",
            "description": "Offer to purchase Penthouse unit",
        },
    )
    assert txn_res.status_code == 201, txn_res.text
    txn = txn_res.json()
    txn_id = txn["id"]
    assert txn["status"] == "PENDING_SELLER_ACCEPTANCE"
    assert txn["seller_id"] == str(owner_user.id)
    assert txn["buyer_id"] == str(buyer_user.id)

    # 3. Seller sees pending approval in inbox
    inbox_res = client.get(
        "/api/v1/approvals/pending",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert inbox_res.status_code == 200
    assert any(a["transaction_id"] == txn_id for a in inbox_res.json())

    # 4. Stranger cannot accept or reject (403)
    stranger_res = client.post(
        f"/api/v1/transactions/{txn_id}/accept",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert stranger_res.status_code == 403

    # 5. Seller accepts transaction
    accept_res = client.post(
        f"/api/v1/transactions/{txn_id}/accept",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["status"] == "PENDING_DOCUMENT_VERIFICATION"

    # 6. Verifier approves documents
    verify_res = client.post(
        f"/api/v1/transactions/{txn_id}/verify-documents?comments=Title+cleared+by+auditor",
        headers={"Authorization": f"Bearer {verifier_token}"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "READY_FOR_LEGAL_CONFIRMATION"

    # 7. CRITICAL SECURITY TEST: ADMIN CANNOT CONFIRM LEGAL REGISTRATION
    admin_confirm = client.post(
        f"/api/v1/transactions/{txn_id}/legal-confirm",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "registration_reference": "GOA-PAN-2026-881",
            "registry_jurisdiction": "Panaji Sub-Registrar",
            "registration_date": "2026-10-30",
            "comments": "Admin attempt to confirm legal transfer",
        },
    )
    assert admin_confirm.status_code == 403, "Admin must NOT be allowed to confirm legal registration!"

    # 8. Legal Authority confirms legal registration
    legal_confirm = client.post(
        f"/api/v1/transactions/{txn_id}/legal-confirm",
        headers={"Authorization": f"Bearer {legal_token}"},
        json={
            "registration_reference": "GOA-PAN-2026-881",
            "registry_jurisdiction": "Panaji Sub-Registrar",
            "registration_date": "2026-10-30",
            "comments": "Statutory land deed registered in state revenue books.",
        },
    )
    assert legal_confirm.status_code == 200, legal_confirm.text
    final_txn = legal_confirm.json()
    assert final_txn["status"] in {"LEGALLY_REGISTERED", "COMPLETED"}

    # 9. Verify property ownership has transferred to Buyer!
    updated_prop = client.get(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {buyer_token}"},
    ).json()
    assert updated_prop["current_owner_id"] == str(buyer_user.id)


def test_seller_rejection_workflow(
    client: TestClient,
    owner_user: User,
    buyer_user: User,
    admin_user: User,
):
    owner_token = _get_token(client, owner_user)
    buyer_token = _get_token(client, buyer_user)
    admin_token = _get_token(client, admin_user)

    # Register property
    prop = client.post(
        "/api/v1/properties",
        json={
            "title": "Commercial Warehouse",
            "property_type": "INDUSTRIAL",
            "country": "India",
            "state": "Delhi",
            "city": "New Delhi",
            "street_address": "88 Okhla Phase III",
            "postal_code": "110020",
            "land_area": 10000.0,
            "survey_number": f"SURV-DEL-{uuid.uuid4().hex[:6]}",
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    # Admin verifies property
    client.patch(
        f"/api/v1/properties/{prop['id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"verification_status": "VERIFIED"},
    )

    # Buyer initiates proposal
    txn = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "property_id": prop["id"],
            "proposed_amount": 5000000.00,
            "currency": "INR",
            "transaction_type": "SALE",
        },
    ).json()

    # Seller rejects proposal with mandatory reason
    reject_res = client.post(
        f"/api/v1/transactions/{txn['id']}/reject",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"reason": "Offer amount is below market valuation."},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"
    assert reject_res.json()["seller_rejection_reason"] == "Offer amount is below market valuation."

