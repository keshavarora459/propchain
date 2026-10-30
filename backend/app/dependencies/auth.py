"""
Authentication Route Dependencies for PropChain FastAPI Application.
Extracts and validates Bearer JWT tokens and resolves the authenticated User entity.
"""
import uuid
from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import PropChainException
from app.core.permissions import AccountStatus
from app.core.security import AuthenticationError, decode_token
from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.user_repository import user_repository

# Standard HTTP Bearer scheme
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency that extracts the Bearer JWT token from Authorization header,
    decodes and validates claims, and queries the database for the active user.
    """
    if not credentials or not credentials.credentials:
        raise AuthenticationError("Authentication token is required. Please log in.")

    token = credentials.credentials
    payload = decode_token(token, expected_type="access")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationError("Token payload is missing user identity.")

    try:
        user_id = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        raise AuthenticationError("Token contains malformed user identifier.")

    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise AuthenticationError("User associated with this token does not exist.")

    if user.account_status != AccountStatus.ACTIVE.value:
        raise PropChainException(
            message=f"Account is {user.account_status.lower()}. Access is restricted.",
            status_code=403,
        )

    return user

