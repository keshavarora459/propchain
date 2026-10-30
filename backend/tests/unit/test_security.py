"""
Unit tests for PropChain Security Utilities (Argon2id and PyJWT).
"""
import uuid
import pytest
from app.core.security import (
    AuthenticationError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)


def test_argon2id_password_hashing():
    """Verify passwords are correctly hashed and verified with Argon2id."""
    password = "StrongPassword123!"
    hashed = hash_password(password)

    assert hashed != password
    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_password_strength_validation():
    """Verify password complexity requirements."""
    # Valid password
    valid, msg = validate_password_strength("ValidPass123!")
    assert valid is True
    assert msg is None

    # Too short
    valid, msg = validate_password_strength("Sh1!")
    assert valid is False
    assert "at least 8" in msg

    # Missing uppercase
    valid, msg = validate_password_strength("lowercase123!")
    assert valid is False
    assert "uppercase" in msg

    # Missing digit
    valid, msg = validate_password_strength("NoDigitsHere!")
    assert valid is False
    assert "digit" in msg

    # Missing special symbol
    valid, msg = validate_password_strength("NoSpecialSymbols123")
    assert valid is False
    assert "special symbol" in msg


def test_jwt_access_token_creation_and_validation():
    """Verify JWT access token creation and decoding."""
    user_id = uuid.uuid4()
    role = "BUYER"
    token = create_access_token(user_id=user_id, role=role)

    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == str(user_id)
    assert payload["role"] == role
    assert payload["type"] == "access"
    assert "jti" in payload
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_refresh_token_creation_and_validation():
    """Verify JWT refresh token creation and decoding."""
    user_id = uuid.uuid4()
    token, jti, expire = create_refresh_token(user_id=user_id)

    payload = decode_token(token, expected_type="refresh")
    assert payload["sub"] == str(user_id)
    assert payload["jti"] == jti
    assert payload["type"] == "refresh"


def test_jwt_token_type_mismatch():
    """Verify attempting to use an access token as a refresh token is rejected."""
    user_id = uuid.uuid4()
    access_token = create_access_token(user_id=user_id, role="BUYER")

    with pytest.raises(AuthenticationError) as exc_info:
        decode_token(access_token, expected_type="refresh")
    assert "Invalid token type" in str(exc_info.value)


def test_token_hash_sha256():
    """Verify token hash function generates deterministic SHA-256 digests."""
    sample = "test_token_string_value"
    digest1 = hash_token(sample)
    digest2 = hash_token(sample)
    assert digest1 == digest2
    assert len(digest1) == 64

