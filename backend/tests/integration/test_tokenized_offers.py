"""
Integration tests for Tokenized vs Entire Property Offer Workflows in PropChain.
"""
import hashlib
import uuid
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.models.document import PropertyDocument
from app.models.property import Property
from app.models.user import User


def _make_user(db_session, role: str, name: str) -> User:
    u = User(
        full_name=name,
        email=f"{role.lower()}_{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("StrongPassword!123"),
        role=role,
        account_status="ACTIVE",
        email_verified=True,
    )
    db_session.add(u)
    db_session.commit()
    return u


def _login(client: TestClient, user: User) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "StrongPassword!123"},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _verify_prop(client: TestClient, db_session, verifier: User, verifier_tok: str, prop_id: str) -> None:
    prop = db_session.get(Property, uuid.UUID(prop_id))
    assert prop is not None
    for doc_type in ["TITLE_DEED", "CADASTRAL_SURVEY", "TAX_CLEARANCE", "ENCUMBRANCE_CERTIFICATE"]:
        doc = PropertyDocument(
            property_id=prop.id,
            uploader_user_id=prop.creator_user_id,
            document_type=doc_type,
            title=f"{doc_type} Sample",
            original_filename=f"{doc_type.lower()}_{uuid.uuid4().hex[:6]}.pdf",
            storage_path=f"/tmp/test/{uuid.uuid4().hex}.pdf",
            file_size=1024,
            mime_type="application/pdf",
            document_hash=hashlib.sha256(f"{prop.id}:{doc_type}:{uuid.uuid4().hex}".encode()).hexdigest(),
            status="VERIFIED",
        )
        db_session.add(doc)
    prop.verification_status = "SUBMITTED"
    prop.status = "UNDER_REVIEW"
    db_session.commit()

    with patch(
        "app.services.blockchain_service.BlockchainService.anchor_property",
        return_value=(True, f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", None),
    ):
        res = client.post(
            f"/api/v1/properties/{prop_id}/verify",
            headers={"Authorization": f"Bearer {verifier_tok}"},
        )
        assert res.status_code == 200, res.text


def _complete_deal(
    client: TestClient,
    txn_id: str,
    seller_token: str,
    verifier_token: str,
    legal_token: str,
):
    assert client.post(
        f"/api/v1/transactions/{txn_id}/accept",
        headers={"Authorization": f"Bearer {seller_token}"},
    ).status_code == 200

    assert client.post(
        f"/api/v1/transactions/{txn_id}/verify-documents",
        headers={"Authorization": f"Bearer {verifier_token}"},
    ).status_code == 200

    with patch("app.services.blockchain_service.BlockchainService.is_network_connected", return_value=True), \
         patch(
             "app.services.blockchain_service.BlockchainService.execute_ownership_transfer",
             return_value=(True, f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", 12, None),
         ) as mock_transfer:
        res = client.post(
            f"/api/v1/transactions/{txn_id}/legal-confirm",
            headers={"Authorization": f"Bearer {legal_token}"},
            json={
                "registration_reference": f"DEED-{uuid.uuid4().hex[:6]}",
                "registry_jurisdiction": "District 1 Registry",
                "registration_date": "2026-11-10",
                "comments": "Approved for settlement",
            },
        )
        assert res.status_code == 200, res.text
        return res.json(), mock_transfer


def test_tokenized_vs_entire_property_offers_and_partial_settlement(client: TestClient, db_session):
    seller = _make_user(db_session, "PROPERTY_OWNER", "Alice Seller")
    buyer1 = _make_user(db_session, "BUYER", "Bob Buyer")
    buyer2 = _make_user(db_session, "BUYER", "Clara Investor")
    verifier = _make_user(db_session, "REGISTRAR", "John Registrar")
    legal = _make_user(db_session, "LEGAL_AUTHORITY", "Chief Registrar")

    seller_tok = _login(client, seller)
    buyer1_tok = _login(client, buyer1)
    buyer2_tok = _login(client, buyer2)
    verifier_tok = _login(client, verifier)
    legal_tok = _login(client, legal)

    # 1. Create a tokenized property matching the UI format + an entire property
    tok_prop_res = client.post(
        "/api/v1/properties",
        headers={"Authorization": f"Bearer {seller_tok}"},
        json={
            "title": "Makka Singh Colony",
            "property_type": "COMMERCIAL",
            "property_category": "TOKENIZED",
            "country": "India",
            "state": "Punjab",
            "city": "Amritsar",
            "street_address": "100 Heritage Avenue",
            "postal_code": "143001",
            "land_area": 50000,
            "valuation": 7000000,
            "description": (
                "[TOKENIZED SALE] Symbol: PROP-TKN | Total Supply: 10,000 tokens | "
                "Token Price: $700 | Min Purchase: 5 tokens | Projected APY: 8.5% | "
                "Prime commercial block."
            ),
            "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
        },
    )
    assert tok_prop_res.status_code == 201, tok_prop_res.text
    tok_prop = tok_prop_res.json()
    assert tok_prop["is_tokenized"] is True
    assert tok_prop["token_symbol"] == "PROP-TKN"
    assert tok_prop["total_tokens"] == 10000
    assert tok_prop["token_price"] == 700.0
    assert tok_prop["min_tokens_per_buyer"] == 5
    assert tok_prop["projected_apy"] == 8.5
    assert tok_prop["available_tokens"] == 10000
    _verify_prop(client, db_session, verifier, verifier_tok, tok_prop["id"])

    entire_prop_res = client.post(
        "/api/v1/properties",
        headers={"Authorization": f"Bearer {seller_tok}"},
        json={
            "title": "Star Tower",
            "property_type": "RESIDENTIAL",
            "property_category": "APARTMENT",
            "country": "India",
            "state": "Punjab",
            "city": "Mohali",
            "street_address": "22 Star Enclave",
            "postal_code": "160055",
            "land_area": 2400,
            "valuation": 100000,
            "description": "[ENTIRE PROPERTY SALE] Complete luxury residence.",
            "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
        },
    )
    assert entire_prop_res.status_code == 201, entire_prop_res.text
    entire_prop = entire_prop_res.json()
    assert entire_prop["is_tokenized"] is False
    assert entire_prop["available_tokens"] is None
    _verify_prop(client, db_session, verifier, verifier_tok, entire_prop["id"])

    # 2. Guard checks: cannot send TOKEN_PURCHASE on non-tokenized property
    bad_mode = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer1_tok}"},
        json={
            "property_id": entire_prop["id"],
            "purchase_mode": "TOKEN_PURCHASE",
            "token_quantity": 10,
            "proposed_amount": 5000,
            "currency": "USD",
        },
    )
    assert bad_mode.status_code == 400
    assert "only allowed on tokenized" in bad_mode.text.lower()

    # 3. Guard checks: below min tokens or above available tokens on tokenized property
    too_few = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer1_tok}"},
        json={
            "property_id": tok_prop["id"],
            "purchase_mode": "TOKEN_PURCHASE",
            "token_quantity": 2,
            "currency": "USD",
        },
    )
    assert too_few.status_code == 400
    assert "minimum token purchase is 5" in too_few.text.lower()

    too_many = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer1_tok}"},
        json={
            "property_id": tok_prop["id"],
            "purchase_mode": "TOKEN_PURCHASE",
            "token_quantity": 10001,
            "currency": "USD",
        },
    )
    assert too_many.status_code == 400
    assert "exceeds available supply" in too_many.text.lower()

    # 4. Buyer 1 submits a valid fractional token offer (omitting proposed_amount to verify auto-calc)
    b1_txn_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer1_tok}"},
        json={
            "property_id": tok_prop["id"],
            "purchase_mode": "TOKEN_PURCHASE",
            "token_quantity": 100,
            "currency": "USD",
        },
    )
    assert b1_txn_res.status_code == 201, b1_txn_res.text
    b1_txn = b1_txn_res.json()
    assert b1_txn["purchase_mode"] == "TOKEN_PURCHASE"
    assert b1_txn["token_quantity"] == 100
    assert b1_txn["token_symbol"] == "PROP-TKN"
    assert b1_txn["ownership_percentage"] == 1.0
    assert float(b1_txn["proposed_amount"]) == 70000.0

    # Also submit a competing whole-property offer BEFORE fractional settlement completes
    competing_whole_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer2_tok}"},
        json={
            "property_id": tok_prop["id"],
            "purchase_mode": "ENTIRE_PROPERTY",
            "proposed_amount": 7000000,
            "currency": "USD",
        },
    )
    assert competing_whole_res.status_code == 201, competing_whole_res.text
    competing_whole = competing_whole_res.json()
    assert competing_whole["purchase_mode"] == "ENTIRE_PROPERTY"
    assert competing_whole["ownership_percentage"] == 100.0

    # Approvals endpoint carries token allocation metadata
    pending_apprs = client.get(
        "/api/v1/approvals/pending",
        headers={"Authorization": f"Bearer {seller_tok}"},
    ).json()
    b1_appr = next(a for a in pending_apprs if a["transaction_id"] == b1_txn["id"])
    assert b1_appr["purchase_mode"] == "TOKEN_PURCHASE"
    assert b1_appr["token_quantity"] == 100
    assert b1_appr["ownership_percentage"] == 1.0

    # 5. Complete Buyer 1's 100-token settlement -> property stays ACTIVE, whole offer auto-cancelled
    settled1, mock_transfer = _complete_deal(client, b1_txn["id"], seller_tok, verifier_tok, legal_tok)
    assert settled1["status"] == "COMPLETED"
    mock_transfer.assert_called_once()
    call_kwargs = mock_transfer.call_args.kwargs
    assert call_kwargs["is_fractional"] is True
    assert call_kwargs["token_quantity"] == 100
    assert call_kwargs["ownership_percentage"] == 1.0

    updated_tok_prop = client.get(
        f"/api/v1/properties/{tok_prop['id']}",
        headers={"Authorization": f"Bearer {buyer2_tok}"},
    ).json()
    assert updated_tok_prop["status"] == "ACTIVE"
    assert updated_tok_prop["current_owner_id"] == str(seller.id)
    assert updated_tok_prop["tokens_sold"] == 100
    assert updated_tok_prop["available_tokens"] == 9900

    # Competing whole offer was automatically cancelled
    competing_detail = client.get(
        f"/api/v1/transactions/{competing_whole['id']}",
        headers={"Authorization": f"Bearer {buyer2_tok}"},
    ).json()
    assert competing_detail["status"] == "CANCELLED"

    # Analytics dashboard shows Buyer 1's fractional token stake
    buyer1_dash = client.get(
        "/api/v1/analytics/dashboard",
        headers={"Authorization": f"Bearer {buyer1_tok}"},
    ).json()
    holdings = buyer1_dash["buyer_metrics"]["my_token_holdings"]
    assert len(holdings) == 1
    assert holdings[0]["tokens_owned"] == 100
    assert holdings[0]["ownership_percentage"] == 1.0

    # 6. Now whole-property buyout is blocked because 100 tokens are sold
    blocked_whole = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer2_tok}"},
        json={
            "property_id": tok_prop["id"],
            "purchase_mode": "ENTIRE_PROPERTY",
            "proposed_amount": 7000000,
            "currency": "USD",
        },
    )
    assert blocked_whole.status_code == 400
    assert "already been settled" in blocked_whole.text.lower()

    # 7. Buyer 2 purchases the remaining 9,900 tokens -> property sells out (INACTIVE)
    b2_txn_res = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer2_tok}"},
        json={
            "property_id": tok_prop["id"],
            "purchase_mode": "TOKEN_PURCHASE",
            "token_quantity": 9900,
            "currency": "USD",
        },
    )
    assert b2_txn_res.status_code == 201, b2_txn_res.text
    settled2, _ = _complete_deal(client, b2_txn_res.json()["id"], seller_tok, verifier_tok, legal_tok)
    assert settled2["status"] == "COMPLETED"

    sold_out_prop = client.get(
        f"/api/v1/properties/{tok_prop['id']}",
        headers={"Authorization": f"Bearer {seller_tok}"},
    ).json()
    assert sold_out_prop["status"] == "INACTIVE"
    assert sold_out_prop["tokens_sold"] == 10000
    assert sold_out_prop["available_tokens"] == 0


def test_untouched_tokenized_property_allows_full_buyout_and_transfers_deed(client: TestClient, db_session):
    seller = _make_user(db_session, "PROPERTY_OWNER", "Token Issuer")
    buyer = _make_user(db_session, "BUYER", "Institutional Buyer")
    verifier = _make_user(db_session, "REGISTRAR", "Title Verifier")
    legal = _make_user(db_session, "LEGAL_AUTHORITY", "Land Registrar")

    seller_tok = _login(client, seller)
    buyer_tok = _login(client, buyer)
    verifier_tok = _login(client, verifier)
    legal_tok = _login(client, legal)

    prop = client.post(
        "/api/v1/properties",
        headers={"Authorization": f"Bearer {seller_tok}"},
        json={
            "title": "Whole Buyout Plaza",
            "property_type": "COMMERCIAL",
            "property_category": "TOKENIZED",
            "country": "India",
            "state": "Delhi",
            "city": "New Delhi",
            "street_address": "1 Connaught Place",
            "postal_code": "110001",
            "land_area": 10000,
            "valuation": 2000000,
            "token_symbol": "WBP-TKN",
            "total_tokens": 2000,
            "token_price": 1000,
            "min_tokens_per_buyer": 10,
            "projected_apy": 9.2,
            "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
        },
    ).json()
    assert prop["is_tokenized"] is True
    assert prop["token_symbol"] == "WBP-TKN"
    _verify_prop(client, db_session, verifier, verifier_tok, prop["id"])

    # Entire property buyout while 0 tokens sold
    txn = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer_tok}"},
        json={
            "property_id": prop["id"],
            "purchase_mode": "ENTIRE_PROPERTY",
            "proposed_amount": 2000000,
            "currency": "USD",
        },
    ).json()
    assert txn["purchase_mode"] == "ENTIRE_PROPERTY"
    assert txn["ownership_percentage"] == 100.0

    settled, mock_transfer = _complete_deal(client, txn["id"], seller_tok, verifier_tok, legal_tok)
    assert settled["status"] == "COMPLETED"
    assert mock_transfer.call_args.kwargs["is_fractional"] is False

    updated = client.get(
        f"/api/v1/properties/{prop['id']}",
        headers={"Authorization": f"Bearer {buyer_tok}"},
    ).json()
    assert updated["current_owner_id"] == str(buyer.id)
    assert updated["status"] == "INACTIVE"
    assert updated["available_tokens"] == 0


def test_fractional_remnant_smaller_than_minimum_purchase_is_allowed(client: TestClient, db_session):
    seller = _make_user(db_session, "PROPERTY_OWNER", "Issuer")
    buyer = _make_user(db_session, "BUYER", "Remnant Buyer")
    verifier = _make_user(db_session, "REGISTRAR", "Verifier")
    legal = _make_user(db_session, "LEGAL_AUTHORITY", "Legal")

    seller_tok = _login(client, seller)
    buyer_tok = _login(client, buyer)
    verifier_tok = _login(client, verifier)
    legal_tok = _login(client, legal)

    prop = client.post(
        "/api/v1/properties",
        headers={"Authorization": f"Bearer {seller_tok}"},
        json={
            "title": "Small Tranche Tower",
            "property_type": "COMMERCIAL",
            "property_category": "TOKENIZED",
            "country": "India",
            "state": "Punjab",
            "city": "Chandigarh",
            "street_address": "7 Sector 17",
            "postal_code": "160017",
            "land_area": 5000,
            "valuation": 10000,
            "token_symbol": "STT",
            "total_tokens": 10,
            "token_price": 1000,
            "min_tokens_per_buyer": 5,
            "survey_number": f"SURV-{uuid.uuid4().hex[:6]}",
        },
    ).json()
    _verify_prop(client, db_session, verifier, verifier_tok, prop["id"])

    # Buy 7 tokens -> leaves 3 (< min 5)
    t1 = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer_tok}"},
        json={"property_id": prop["id"], "purchase_mode": "TOKEN_PURCHASE", "token_quantity": 7},
    ).json()
    _complete_deal(client, t1["id"], seller_tok, verifier_tok, legal_tok)

    # Buying 2 of remaining 3 should be blocked (must take all 3 when below min 5)
    bad = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer_tok}"},
        json={"property_id": prop["id"], "purchase_mode": "TOKEN_PURCHASE", "token_quantity": 2},
    )
    assert bad.status_code == 400

    # Buying exact remaining 3 should succeed even though 3 < min 5
    ok = client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {buyer_tok}"},
        json={"property_id": prop["id"], "purchase_mode": "TOKEN_PURCHASE", "token_quantity": 3},
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["ownership_percentage"] == 30.0

