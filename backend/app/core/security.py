"""
Security Utilities for PropChain Backend.
Implements Argon2id password hashing and robust PyJWT lifecycle management.
"""
import hashlib
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("security")

# Configure Argon2id Password Hasher according to cryptographic recommendations
_hasher = PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MB
    parallelism=1,
    hash_len=32,
)


class AuthenticationError(Exception):
    """Raised for authentication failures."""
    def __init__(self, message: str = "Invalid authentication credentials.", status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class TokenRevokedOrReusedError(AuthenticationError):
    """Raised when an invalid, revoked, or reused refresh token is presented."""
    def __init__(self, message: str = "Authentication token is invalid or has been revoked."):
        super().__init__(message=message, status_code=401)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception as exc:
        logger.error("Unexpected error during password verification: %s", exc)
        return False


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password complexity:
    - Minimum 8 characters, maximum 128
    - At least one lowercase letter
    - At least one uppercase letter
    - At least one decimal digit
    - At least one special symbol
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters in length."
    if len(password) > 128:
        return False, "Password cannot exceed 128 characters in length."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one decimal digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special symbol (!@#$%^&*...)."
    return True, None


def hash_token(token: str) -> str:
    """Compute SHA-256 digest of token string for safe database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
    user_id: uuid.UUID,
    role: str,
    additional_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate a short-lived signed JWT access token.
    Default lifespan: 15 minutes.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_jti = str(uuid.uuid4())

    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "jti": token_jti,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if additional_claims:
        payload.update(additional_claims)

    encoded = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded


def create_refresh_token(
    user_id: uuid.UUID,
    jti: Optional[str] = None,
) -> Tuple[str, str, datetime]:
    """
    Generate a signed JWT refresh token with unique jti.
    Default lifespan: 7 days.
    Returns: (token_str, jti, expires_at_datetime)
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    token_jti = jti or str(uuid.uuid4())

    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": token_jti,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    encoded = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded, token_jti, expire


def decode_token(
    token: str,
    expected_type: str = "access",
) -> Dict[str, Any]:
    """
    Decode and validate token signature, expiration, issuer, audience, and token type.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={
                "require": ["exp", "iat", "sub", "jti", "type", "iss", "aud"],
                "verify_exp": True,
            },
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired. Please authenticate again.")
    except jwt.InvalidIssuerError:
        raise AuthenticationError("Invalid token issuer.")
    except jwt.InvalidAudienceError:
        raise AuthenticationError("Invalid token audience.")
    except jwt.PyJWTError as exc:
        logger.warning("JWT decoding failure: %s", exc)
        raise AuthenticationError("Invalid authentication token.")

    token_type = payload.get("type")
    if token_type != expected_type:
        raise AuthenticationError(f"Invalid token type: expected '{expected_type}', got '{token_type}'.")

    return payload
