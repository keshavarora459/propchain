"""
Integration tests for EVM & MetaMask Wallet Linking in PropChain.
Tests cryptographic challenge generation, EIP-191 signature verification,
rejection of forged signatures, and wallet profile association.
"""
import uuid
import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient


@pytest.fixture
def auth_token(client: TestClient) -> str:
    email = f"wallet_user_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Web3 Stakeholder",
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


def test_wallet_challenge_and_signature_verification(client: TestClient, auth_token: str):
    # 1. Create a test EVM private key and address
    test_account = Account.create()
    wallet_address = test_account.address

    # 2. Request challenge
    challenge_res = client.post(
        "/api/v1/wallet/challenge",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"wallet_address": wallet_address, "chain_id": 31337},
    )
    assert challenge_res.status_code == 200, challenge_res.text
    challenge_data = challenge_res.json()
    challenge_msg = challenge_data["challenge_message"]
    nonce = challenge_data["nonce"]

    # 3. Sign the challenge text using standard EIP-191 personal_sign
    encoded = encode_defunct(text=challenge_msg)
    signed_msg = test_account.sign_message(encoded)
    signature_hex = signed_msg.signature.hex()
    if not signature_hex.startswith("0x"):
        signature_hex = "0x" + signature_hex

    # 4. Submit signature for verification
    verify_res = client.post(
        "/api/v1/wallet/verify",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "wallet_address": wallet_address,
            "signature": signature_hex,
            "nonce": nonce,
        },
    )
    assert verify_res.status_code == 200, verify_res.text
    verify_data = verify_res.json()
    assert verify_data["wallet_address"].lower() == wallet_address.lower()
    assert verify_data["is_verified"] is True
    assert verify_data["chain_id"] == 31337

    # 5. Query /wallet/me to confirm association
    me_res = client.get(
        "/api/v1/wallet/me",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert me_res.status_code == 200
    wallets = me_res.json()
    assert len(wallets) >= 1
    assert any(w["wallet_address"].lower() == wallet_address.lower() for w in wallets)


def test_forged_signature_rejected(client: TestClient, auth_token: str):
    # Victim wallet address and attacker private key
    victim_account = Account.create()
    attacker_account = Account.create()

    # Request challenge for victim address
    challenge_res = client.post(
        "/api/v1/wallet/challenge",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"wallet_address": victim_account.address, "chain_id": 31337},
    )
    challenge_data = challenge_res.json()

    # Attacker signs the message with their own private key
    encoded = encode_defunct(text=challenge_data["challenge_message"])
    forged_signature = attacker_account.sign_message(encoded).signature.hex()
    if not forged_signature.startswith("0x"):
        forged_signature = "0x" + forged_signature

    # Attempt verification -> must be rejected
    verify_res = client.post(
        "/api/v1/wallet/verify",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "wallet_address": victim_account.address,
            "signature": forged_signature,
            "nonce": challenge_data["nonce"],
        },
    )
    assert verify_res.status_code == 403
    assert "mismatch" in (verify_res.json().get("message") or "").lower()

