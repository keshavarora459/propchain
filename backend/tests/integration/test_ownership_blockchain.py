"""
Integration tests for Blockchain Service, Smart Contract Anchoring, and Ownership Ledger in PropChain.
Tests live connection to Hardhat EVM node (port 8545), property registration on-chain,
transaction receipt verification, and ownership events.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from app.services.blockchain_service import BlockchainService


@pytest.fixture
def owner_token(client: TestClient) -> str:
    email = f"owner_bc_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Genesis Property Owner",
            "email": email,
            "password": "StrongPassword!123",
            "confirm_password": "StrongPassword!123",
            "terms_accepted": True,
            "role": "PROPERTY_OWNER",
        },
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPassword!123"},
    )
    return res.json()["access_token"]


def test_blockchain_service_connection(db_session):
    service = BlockchainService(db_session)
    assert service.is_network_connected() is True
    assert service.property_registry is not None
    assert service.ownership_registry is not None


def test_anchor_property_on_local_blockchain(client: TestClient, owner_token: str, db_session):
    # 1. Register a property in PostgreSQL
    payload = {
        "title": "On-Chain Verified Estate",
        "property_type": "RESIDENTIAL",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "street_address": "77 Blockchain Way",
        "postal_code": "400001",
        "land_area": 3500.0,
        "survey_number": f"SURV-BC-{uuid.uuid4().hex[:6]}",
        "registration_number": f"REG-BC-{uuid.uuid4().hex[:6]}",
    }
    prop_res = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert prop_res.status_code == 201
    prop_id = prop_res.json()["id"]

    # 2. Anchor property on local EVM blockchain
    anchor_res = client.post(
        f"/api/v1/properties/{prop_id}/anchor-blockchain",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert anchor_res.status_code == 200, anchor_res.text
    data = anchor_res.json()
    assert data["status"] == "ANCHORED"
    assert data["tx_hash"].startswith("0x")

    # 3. Query property details to confirm blockchain_property_id
    detail_res = client.get(
        f"/api/v1/properties/{prop_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["blockchain_property_id"] is not None

    # 4. Query ownership history for this property
    history_res = client.get(
        f"/api/v1/properties/{prop_id}/ownership-history",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert history_res.status_code == 200
    events = history_res.json()
    assert len(events) >= 1
    assert events[0]["event_type"] == "INITIAL_REGISTRATION"
    assert events[0]["blockchain_tx_hash"] == data["tx_hash"]

