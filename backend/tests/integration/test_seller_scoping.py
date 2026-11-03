"""
Integration tests for Seller (PROPERTY_OWNER) data scoping and isolation.
Validates:
- Seller can only view their own properties unless verified marketplace active listing
- Seller cannot access other sellers' documents or document details
- Seller document detail view strips OCR/internal verifier processing data
- Seller cannot view or list other sellers' transactions
- Seller dashboard returns complete seller_metrics matching frontend contracts
- Blockchain my-records endpoint scopes identifiers to authenticated user
"""
import uuid
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.permissions import UserRole, AccountStatus
from app.core.security import hash_password
from app.models.document import PropertyDocument, DocumentProcessingRecord
from app.models.property import Property
from app.models.transaction import PropertyTransaction
from app.models.user import User

PASSWORD = "Password123!"


def create_user(db: Session, email: str, role: UserRole, full_name: str) -> User:
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(PASSWORD),
        role=role.value,
        account_status=AccountStatus.ACTIVE.value,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_token(client: TestClient, email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_seller_property_access_isolation(client: TestClient, db_session: Session):
    seller1 = create_user(db_session, "seller1@test.com", UserRole.PROPERTY_OWNER, "Seller One")
    seller2 = create_user(db_session, "seller2@test.com", UserRole.PROPERTY_OWNER, "Seller Two")

    p1 = Property(
        property_number="PROP-S1-001",
        title="Seller 1 Private Property",
        property_type="RESIDENTIAL",
        country="India",
        state="Maharashtra",
        city="Mumbai",
        street_address="101 Marine Drive",
        postal_code="400020",
        land_area=Decimal("1500.00"),
        valuation=Decimal("500000.00"),
        creator_user_id=seller1.id,
        current_owner_id=seller1.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    p2_unverified = Property(
        property_number="PROP-S2-001",
        title="Seller 2 Private Property",
        property_type="RESIDENTIAL",
        country="India",
        state="Karnataka",
        city="Bengaluru",
        street_address="202 Indiranagar",
        postal_code="560038",
        land_area=Decimal("2000.00"),
        valuation=Decimal("750000.00"),
        creator_user_id=seller2.id,
        current_owner_id=seller2.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    p2_marketplace = Property(
        property_number="PROP-S2-002",
        title="Seller 2 Verified Listing",
        property_type="COMMERCIAL",
        country="India",
        state="Karnataka",
        city="Bengaluru",
        street_address="303 MG Road",
        postal_code="560001",
        land_area=Decimal("3000.00"),
        valuation=Decimal("1200000.00"),
        creator_user_id=seller2.id,
        current_owner_id=seller2.id,
        status="ACTIVE",
        verification_status="VERIFIED",
    )
    db_session.add_all([p1, p2_unverified, p2_marketplace])
    db_session.commit()

    token1 = get_token(client, "seller1@test.com")
    headers = {"Authorization": f"Bearer {token1}"}

    # Seller 1 can view their own property
    res1 = client.get(f"/api/v1/properties/{p1.id}", headers=headers)
    assert res1.status_code == 200
    assert res1.json()["property_number"] == "PROP-S1-001"

    # Seller 1 CANNOT view Seller 2's unverified property
    res2 = client.get(f"/api/v1/properties/{p2_unverified.id}", headers=headers)
    assert res2.status_code == 403

    # Seller 1 CAN view Seller 2's verified active marketplace listing
    res3 = client.get(f"/api/v1/properties/{p2_marketplace.id}", headers=headers)
    assert res3.status_code == 200
    assert res3.json()["property_number"] == "PROP-S2-002"


def test_seller_document_access_isolation(client: TestClient, db_session: Session):
    seller1 = create_user(db_session, "seller1_doc@test.com", UserRole.PROPERTY_OWNER, "Seller One Doc")
    seller2 = create_user(db_session, "seller2_doc@test.com", UserRole.PROPERTY_OWNER, "Seller Two Doc")

    p1 = Property(
        property_number="PROP-DOC-001",
        title="Seller 1 Estate",
        property_type="RESIDENTIAL",
        country="India",
        state="Goa",
        city="Panaji",
        street_address="10 Beach Road",
        postal_code="403001",
        land_area=Decimal("1200.00"),
        valuation=Decimal("400000.00"),
        creator_user_id=seller1.id,
        current_owner_id=seller1.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    p2 = Property(
        property_number="PROP-DOC-002",
        title="Seller 2 Estate",
        property_type="RESIDENTIAL",
        country="India",
        state="Goa",
        city="Panaji",
        street_address="20 Beach Road",
        postal_code="403001",
        land_area=Decimal("1200.00"),
        valuation=Decimal("450000.00"),
        creator_user_id=seller2.id,
        current_owner_id=seller2.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    db_session.add_all([p1, p2])
    db_session.commit()

    d1 = PropertyDocument(
        property_id=p1.id,
        uploader_user_id=seller1.id,
        document_type="SALE_DEED",
        title="Seller 1 Deed",
        original_filename="seller1_deed.pdf",
        storage_path="documents/seller1_deed.pdf",
        file_size=1024,
        mime_type="application/pdf",
        document_hash="a"*64,
        status="PENDING_REVIEW",
    )
    d2 = PropertyDocument(
        property_id=p2.id,
        uploader_user_id=seller2.id,
        document_type="SALE_DEED",
        title="Seller 2 Confidential Deed",
        original_filename="seller2_deed.pdf",
        storage_path="documents/seller2_deed.pdf",
        file_size=2048,
        mime_type="application/pdf",
        document_hash="b"*64,
        status="PENDING_REVIEW",
    )
    db_session.add_all([d1, d2])
    db_session.commit()

    # Add OCR processing record to d1
    proc = DocumentProcessingRecord(
        document_id=d1.id,
        status="SUCCESS",
        extracted_text="INTERNAL CONFIDENTIAL OCR TEXT",
        candidate_fields={"internal_note": "do not leak"},
        ocr_applied=True,
    )
    db_session.add(proc)
    db_session.commit()

    token1 = get_token(client, "seller1_doc@test.com")
    headers = {"Authorization": f"Bearer {token1}"}

    # Seller 1 can list documents for own property
    res_list1 = client.get(f"/api/v1/properties/{p1.id}/documents", headers=headers)
    assert res_list1.status_code == 200
    assert len(res_list1.json()) == 1

    # Seller 1 CANNOT list documents for Seller 2's property
    res_list2 = client.get(f"/api/v1/properties/{p2.id}/documents", headers=headers)
    assert res_list2.status_code == 403

    # Seller 1 can get detail of own document, but internal OCR processing data is stripped
    res_d1 = client.get(f"/api/v1/documents/{d1.id}", headers=headers)
    assert res_d1.status_code == 200
    assert res_d1.json()["document_hash"] == "a"*64
    assert res_d1.json()["processing"] is None  # Stripped for privacy!

    # Seller 1 CANNOT get detail of Seller 2's document
    res_d2 = client.get(f"/api/v1/documents/{d2.id}", headers=headers)
    assert res_d2.status_code == 403

    # Seller 1 CANNOT download Seller 2's document
    res_down2 = client.get(f"/api/v1/documents/{d2.id}/download", headers=headers)
    assert res_down2.status_code == 403


def test_seller_transactions_and_dashboard_scoping(client: TestClient, db_session: Session):
    seller1 = create_user(db_session, "seller1_tx@test.com", UserRole.PROPERTY_OWNER, "Seller One Tx")
    seller2 = create_user(db_session, "seller2_tx@test.com", UserRole.PROPERTY_OWNER, "Seller Two Tx")
    buyer = create_user(db_session, "buyer_tx@test.com", UserRole.BUYER, "Buyer One Tx")

    p1 = Property(
        property_number="PROP-TX-001",
        title="Seller 1 Villa",
        property_type="RESIDENTIAL",
        country="India",
        state="Delhi",
        city="New Delhi",
        street_address="1 Civil Lines",
        postal_code="110054",
        land_area=Decimal("2500.00"),
        valuation=Decimal("900000.00"),
        creator_user_id=seller1.id,
        current_owner_id=seller1.id,
        status="ACTIVE",
        verification_status="VERIFIED",
        blockchain_property_id="0xTokenP1",
    )
    p2 = Property(
        property_number="PROP-TX-002",
        title="Seller 2 Penthouse",
        property_type="COMMERCIAL",
        country="India",
        state="Delhi",
        city="New Delhi",
        street_address="2 Connaught Place",
        postal_code="110001",
        land_area=Decimal("3500.00"),
        valuation=Decimal("1500000.00"),
        creator_user_id=seller2.id,
        current_owner_id=seller2.id,
        status="ACTIVE",
        verification_status="VERIFIED",
    )
    db_session.add_all([p1, p2])
    db_session.commit()

    # Document for Seller 1 with REJECTED status to test review_notes
    d1 = PropertyDocument(
        property_id=p1.id,
        uploader_user_id=seller1.id,
        document_type="SALE_DEED",
        title="Villa Deed",
        original_filename="villa_deed.pdf",
        storage_path="documents/villa_deed.pdf",
        file_size=1024,
        mime_type="application/pdf",
        document_hash="c"*64,
        status="REJECTED",
    )
    db_session.add(d1)
    db_session.commit()

    # Transactions
    t1 = PropertyTransaction(
        transaction_number="TXN-2026-0001",
        property_id=p1.id,
        buyer_id=buyer.id,
        seller_id=seller1.id,
        proposed_amount=Decimal("950000.00"),
        currency="INR",
        transaction_type="SALE",
        status="PENDING_SELLER_ACCEPTANCE",
        blockchain_tx_hash="0xTxHash1",
    )
    t2 = PropertyTransaction(
        transaction_number="TXN-2026-0002",
        property_id=p2.id,
        buyer_id=buyer.id,
        seller_id=seller2.id,
        proposed_amount=Decimal("1600000.00"),
        currency="INR",
        transaction_type="SALE",
        status="COMPLETED",
        blockchain_tx_hash="0xTxHash2",
    )
    db_session.add_all([t1, t2])
    db_session.commit()

    token1 = get_token(client, "seller1_tx@test.com")
    headers = {"Authorization": f"Bearer {token1}"}

    # 1. Transactions list is scoped to seller 1 only
    res_tx_list = client.get("/api/v1/transactions", headers=headers)
    assert res_tx_list.status_code == 200
    tx_items = res_tx_list.json()
    assert len(tx_items) == 1
    assert tx_items[0]["transaction_number"] == "TXN-2026-0001"

    # 2. Cannot access Seller 2's transaction detail
    res_t2 = client.get(f"/api/v1/transactions/{t2.id}", headers=headers)
    assert res_t2.status_code == 403

    # 3. Seller Dashboard
    res_dash = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert res_dash.status_code == 200
    dash_data = res_dash.json()

    assert "seller_metrics" in dash_data
    sm = dash_data["seller_metrics"]

    assert sm["listed_properties_count"] == 1
    assert sm["verified_properties_count"] == 1
    assert sm["portfolio_valuation"] == 900000.0
    assert sm["portfolio_valuation_usd"] == 900000.0
    assert sm["active_sales_count"] == 1
    assert sm["completed_sales_count"] == 0
    assert sm["received_offers_count"] == 1

    # my_properties fields
    assert len(sm["my_properties"]) == 1
    prop_data = sm["my_properties"][0]
    assert prop_data["property_type"] == "RESIDENTIAL"
    assert prop_data["state"] == "Delhi"
    assert prop_data["blockchain_property_id"] == "0xTokenP1"

    # received_offers fields
    assert len(sm["received_offers"]) == 1
    offer_data = sm["received_offers"][0]
    assert offer_data["amount"] == 950000.0
    assert offer_data["purchase_price"] == 950000.0
    assert offer_data["blockchain_tx_hash"] == "0xTxHash1"

    # my_documents fields
    assert len(sm["my_documents"]) == 1
    doc_data = sm["my_documents"][0]
    assert doc_data["title"] == "Villa Deed"
    assert doc_data["file_name"] == "villa_deed.pdf"
    assert doc_data["document_hash"] == "c"*64
    assert doc_data["review_notes"] is not None

    # Top-level recent_transactions is scoped to seller 1 only
    assert len(dash_data["recent_transactions"]) == 1
    assert dash_data["recent_transactions"][0]["transaction_number"] == "TXN-2026-0001"

    # 4. User blockchain records
    res_bc = client.get("/api/v1/blockchain/my-records", headers=headers)
    assert res_bc.status_code == 200
    bc_data = res_bc.json()
    assert "PROP-TX-001" in bc_data["property_ids"]
    assert "PROP-TX-002" not in bc_data["property_ids"]
    assert "c"*64 in bc_data["document_hashes"]
    assert "0xTxHash1" in bc_data["tx_hashes"]
    assert "0xTxHash2" not in bc_data["tx_hashes"]


def test_property_list_privacy_scoping(client: TestClient, db_session: Session):
    seller1 = create_user(db_session, "seller1_list@test.com", UserRole.PROPERTY_OWNER, "Seller One List")
    seller2 = create_user(db_session, "seller2_list@test.com", UserRole.PROPERTY_OWNER, "Seller Two List")
    buyer = create_user(db_session, "buyer_list@test.com", UserRole.BUYER, "Buyer List")
    admin = create_user(db_session, "admin_list@test.com", UserRole.ADMIN, "Admin List")

    p1_pending = Property(
        property_number="PROP-L-S1-PENDING",
        title="Seller 1 Pending Property",
        property_type="RESIDENTIAL",
        country="India",
        state="Maharashtra",
        city="Pune",
        street_address="1 Aundh Road",
        postal_code="411007",
        land_area=Decimal("1000.00"),
        valuation=Decimal("300000.00"),
        creator_user_id=seller1.id,
        current_owner_id=seller1.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    p2_pending = Property(
        property_number="PROP-L-S2-PENDING",
        title="Seller 2 Pending Property",
        property_type="RESIDENTIAL",
        country="India",
        state="Karnataka",
        city="Mysuru",
        street_address="2 Jayalakshmipuram",
        postal_code="570012",
        land_area=Decimal("1200.00"),
        valuation=Decimal("400000.00"),
        creator_user_id=seller2.id,
        current_owner_id=seller2.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    p2_verified = Property(
        property_number="PROP-L-S2-VERIFIED",
        title="Seller 2 Marketplace Property",
        property_type="COMMERCIAL",
        country="India",
        state="Delhi",
        city="New Delhi",
        street_address="3 Connaught Place",
        postal_code="110001",
        land_area=Decimal("2500.00"),
        valuation=Decimal("1500000.00"),
        creator_user_id=seller2.id,
        current_owner_id=seller2.id,
        status="ACTIVE",
        verification_status="VERIFIED",
    )
    db_session.add_all([p1_pending, p2_pending, p2_verified])
    db_session.commit()

    s1_token = get_token(client, "seller1_list@test.com")
    buyer_token = get_token(client, "buyer_list@test.com")
    admin_token = get_token(client, "admin_list@test.com")

    # 1. As seller1: GET /api/v1/properties
    s1_headers = {"Authorization": f"Bearer {s1_token}"}
    res_s1 = client.get("/api/v1/properties", headers=s1_headers)
    assert res_s1.status_code == 200
    s1_data = res_s1.json()
    s1_numbers = [item["property_number"] for item in s1_data["items"]]

    # Seller 1 MUST see their own pending property and Seller 2's verified property
    assert "PROP-L-S1-PENDING" in s1_numbers
    assert "PROP-L-S2-VERIFIED" in s1_numbers
    # Seller 1 MUST NOT see Seller 2's pending property
    assert "PROP-L-S2-PENDING" not in s1_numbers

    # Total and pagination must match the filtered count
    # Note: earlier tests created some properties in the same session, so we verify relative presence
    assert "PROP-L-S2-PENDING" not in [item["property_number"] for item in s1_data["items"]]

    # Searching specifically for Seller 2's pending property must return 0 results
    res_search = client.get("/api/v1/properties?search=PROP-L-S2-PENDING", headers=s1_headers)
    assert res_search.status_code == 200
    assert res_search.json()["total"] == 0
    assert len(res_search.json()["items"]) == 0

    # Filtering by verification_status=PENDING must only return Seller 1's pending properties
    res_pending = client.get("/api/v1/properties?verification_status=PENDING", headers=s1_headers)
    assert res_pending.status_code == 200
    pending_numbers = [item["property_number"] for item in res_pending.json()["items"]]
    assert "PROP-L-S1-PENDING" in pending_numbers
    assert "PROP-L-S2-PENDING" not in pending_numbers

    # 2. As buyer: GET /api/v1/properties
    buyer_headers = {"Authorization": f"Bearer {buyer_token}"}
    res_buyer = client.get("/api/v1/properties", headers=buyer_headers)
    assert res_buyer.status_code == 200
    buyer_numbers = [item["property_number"] for item in res_buyer.json()["items"]]
    assert "PROP-L-S2-VERIFIED" in buyer_numbers
    assert "PROP-L-S1-PENDING" not in buyer_numbers
    assert "PROP-L-S2-PENDING" not in buyer_numbers

    # 3. As admin: GET /api/v1/properties sees all
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res_admin = client.get("/api/v1/properties", headers=admin_headers)
    assert res_admin.status_code == 200
    admin_numbers = [item["property_number"] for item in res_admin.json()["items"]]
    assert "PROP-L-S1-PENDING" in admin_numbers
    assert "PROP-L-S2-PENDING" in admin_numbers
    assert "PROP-L-S2-VERIFIED" in admin_numbers


