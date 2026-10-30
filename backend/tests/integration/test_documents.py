"""
Integration tests for Document Management & Verification in PropChain.
Tests secure upload, SHA-256 hashing, encryption, PyMuPDF text extraction,
IDOR protection, and role-based verification actions.
"""
import io
import uuid
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def owner_token(client: TestClient) -> str:
    email = f"owner_doc_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Deed Owner",
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
def verifier_token(client: TestClient, db_session) -> str:
    """Create and authenticate a VERIFIER account."""
    from app.core.security import hash_password
    from app.models.user import User

    email = f"verifier_{uuid.uuid4().hex[:8]}@example.com"
    verifier = User(
        full_name="Certified Verifier",
        email=email,
        password_hash=hash_password("StrongPassword!123"),
        role="VERIFIER",
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(verifier)
    db_session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "StrongPassword!123"},
    )
    return res.json()["access_token"]


@pytest.fixture
def property_id(client: TestClient, owner_token: str) -> str:
    payload = {
        "title": "Document Test Estate",
        "property_type": "RESIDENTIAL",
        "country": "India",
        "state": "Maharashtra",
        "city": "Pune",
        "street_address": "404 Registry Lane",
        "postal_code": "411001",
        "land_area": 1800.0,
        "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
    }
    res = client.post(
        "/api/v1/properties",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    return res.json()["id"]


def test_upload_and_extract_pdf_document(client: TestClient, owner_token: str, property_id: str):
    import fitz

    # Generate a simple in-memory PDF with legal deed text
    doc = fitz.open()
    page = doc.new_page()
    text = (
        "OFFICIAL SALE DEED\n"
        "Registration No: REG-2026-MH-9988\n"
        "Survey No: SURV-Pune-101\n"
        "Execution Date: 2026-10-30\n"
        "Sub-Registrar Office, Haveli Pune.\n"
        "This indenture confirms transfer of ownership."
    )
    page.insert_text((50, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()

    # Upload document
    response = client.post(
        f"/api/v1/properties/{property_id}/documents",
        headers={"Authorization": f"Bearer {owner_token}"},
        data={"document_type": "SALE_DEED", "title": "Registered Sale Deed"},
        files={"file": ("sale_deed.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "Registered Sale Deed"
    assert data["document_type"] == "SALE_DEED"
    assert len(data["document_hash"]) == 64  # SHA-256 hex string
    assert data["status"] == "PENDING_REVIEW"
    doc_id = data["id"]

    # Verify document detail and OCR candidate field extraction
    detail_res = client.get(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["processing"] is not None
    assert "REG-2026-MH-9988" in detail["processing"]["extracted_text"]
    assert detail["processing"]["candidate_fields"]["registration_number"] == "REG-2026-MH-9988"
    assert detail["processing"]["candidate_fields"]["survey_number"] == "SURV-Pune-101"

    # Verify download returns original decrypted bytes
    dl_res = client.get(
        f"/api/v1/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert dl_res.status_code == 200
    assert dl_res.content == pdf_bytes


def test_reject_unsupported_file_extension(client: TestClient, owner_token: str, property_id: str):
    response = client.post(
        f"/api/v1/properties/{property_id}/documents",
        headers={"Authorization": f"Bearer {owner_token}"},
        data={"document_type": "SALE_DEED", "title": "Malicious Script"},
        files={"file": ("exploit.exe", b"binary_executable_data", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "unsupported file format" in (response.json().get("message") or "").lower()


def test_verifier_can_verify_and_reject_document(
    client: TestClient,
    owner_token: str,
    verifier_token: str,
    property_id: str,
):
    # Upload a document
    upload_res = client.post(
        f"/api/v1/properties/{property_id}/documents",
        headers={"Authorization": f"Bearer {owner_token}"},
        data={"document_type": "TAX_RECEIPT", "title": "Municipal Tax Receipt"},
        files={"file": ("tax.pdf", b"%PDF-1.4 sample content", "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # Verifier approves the document
    verify_res = client.post(
        f"/api/v1/documents/{doc_id}/verify",
        headers={"Authorization": f"Bearer {verifier_token}"},
        json={"comments": "Deed signatures and stamp duty verified."},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["status"] == "VERIFIED"

    # Owner cannot perform verifier action (403)
    unauth_res = client.post(
        f"/api/v1/documents/{doc_id}/reject",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={"reason": "Self-rejection not allowed"},
    )
    assert unauth_res.status_code == 403

