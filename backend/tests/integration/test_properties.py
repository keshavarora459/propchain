"""
Integration tests for Property Management endpoints in PropChain.
Tests registration, duplicate detection, permissions, IDOR safety, search, and status updates.
"""
import uuid
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def owner_token(client: TestClient) -> str:
    """Register and authenticate an active PROPERTY_OWNER."""
    email = f"owner_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Property Owner",
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


@pytest.fixture
def buyer_token(client: TestClient) -> str:
    """Register and authenticate an active BUYER."""
    email = f"buyer_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Buyer",
            "email": email,
            "password": "StrongPassword!123",
            "confirm_password": "StrongPassword!123",
            "terms_accepted": True,
            "role": "BUYER",
        },
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPassword!123"},
    )
    return res.json()["access_token"]


def test_property_owner_can_register_property(client: TestClient, owner_token: str):
    payload = {
        "title": "Greenfield Palm Heights",
        "description": "Luxury residential apartment complex",
        "property_type": "RESIDENTIAL",
        "property_category": "APARTMENT",
        "country": "India",
        "state": "Maharashtra",
        "city": "Mumbai",
        "district": "Mumbai Suburban",
        "locality": "Andheri West",
        "street_address": "Plot 42, Link Road",
        "postal_code": "400053",
        "land_area": 2500.50,
        "built_up_area": 2200.00,
        "area_unit": "SQ_FT",
        "bedrooms": 3,
        "bathrooms": 3,
        "floors": 12,
        "construction_year": 2024,
        "valuation": 15000000.00,
        "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
        "registration_number": f"MH-MUM-{uuid.uuid4().hex[:6]}",
    }
    response = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Greenfield Palm Heights"
    assert data["property_number"].startswith("PROP-")
    assert data["status"] == "ACTIVE"
    assert data["verification_status"] == "PENDING"
    assert data["owner_name"] == "Test Property Owner"


def test_buyer_cannot_register_property(client: TestClient, buyer_token: str):
    payload = {
        "title": "Unauthorized Listing",
        "property_type": "RESIDENTIAL",
        "country": "India",
        "state": "Karnataka",
        "city": "Bengaluru",
        "street_address": "123 Tech Park Road",
        "postal_code": "560100",
        "land_area": 1200.0,
    }
    response = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert response.status_code == 403


def test_duplicate_property_registration_rejected(client: TestClient, owner_token: str):
    unique_survey = f"SURV-DUP-{uuid.uuid4().hex[:6]}"
    unique_reg = f"REG-DUP-{uuid.uuid4().hex[:6]}"
    payload = {
        "title": "Duplicate Parcel Check",
        "property_type": "LAND",
        "country": "India",
        "state": "Gujarat",
        "city": "Ahmedabad",
        "street_address": "55 Riverfront Way",
        "postal_code": "380009",
        "land_area": 5000.0,
        "survey_number": unique_survey,
        "registration_number": unique_reg,
    }

    # First registration
    res1 = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res1.status_code == 201

    # Second registration with identical identifiers
    res2 = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res2.status_code == 409
    error_msg = res2.json().get("message") or res2.json().get("detail", "")
    assert "already exists" in error_msg.lower()


def test_get_and_search_properties(client: TestClient, owner_token: str, buyer_token: str):
    # Register a property
    payload = {
        "title": "Cyber City IT Park",
        "property_type": "COMMERCIAL",
        "country": "India",
        "state": "Haryana",
        "city": "Gurugram",
        "street_address": "Sector 29 Expressway",
        "postal_code": "122002",
        "land_area": 15000.0,
        "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
    }
    created = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    property_id = created["id"]

    # Buyer queries individual property details
    res_get = client.get(
        f"/api/v1/properties/{property_id}",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert res_get.status_code == 200
    assert res_get.json()["id"] == property_id

    # Search by city
    res_search = client.get(
        "/api/v1/properties?city=Gurugram",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert res_search.status_code == 200
    assert any(p["id"] == property_id for p in res_search.json()["items"])


def test_property_update_and_idor_protection(client: TestClient, owner_token: str, buyer_token: str):
    # Register property with owner
    payload = {
        "title": "Initial Hilltop Villa",
        "property_type": "RESIDENTIAL",
        "country": "India",
        "state": "Goa",
        "city": "Panaji",
        "street_address": "88 Beach View",
        "postal_code": "403001",
        "land_area": 3000.0,
        "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
    }
    created = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    ).json()

    property_id = created["id"]

    # Stranger (Buyer) attempts to update property details (IDOR attempt)
    res_unauth = client.patch(
        f"/api/v1/properties/{property_id}",
        json={"title": "Hacked Title Hijack"},
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert res_unauth.status_code == 403

    # Authorized owner updates property details
    res_auth = client.patch(
        f"/api/v1/properties/{property_id}",
        json={"title": "Renovated Hilltop Villa", "bedrooms": 4},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res_auth.status_code == 200
    assert res_auth.json()["title"] == "Renovated Hilltop Villa"
    assert res_auth.json()["bedrooms"] == 4
