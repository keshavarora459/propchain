"""
Pydantic v2 Schemas for User Profiles and Management.
"""
import uuid
from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.permissions import AccountStatus, UserRole, get_role_permissions


class UserResponse(BaseModel):
    """Safe user profile response without credentials."""
    id: uuid.UUID
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    role: str
    account_status: str
    email_verified: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None
    permissions: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_permissions(cls, user: Any) -> "UserResponse":
        role_enum = UserRole(user.role) if user.role in UserRole.__members__ else UserRole.BUYER
        return cls(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            phone_number=user.phone_number,
            role=user.role,
            account_status=user.account_status,
            email_verified=user.email_verified,
            created_at=user.created_at,
            updated_at=user.updated_at,
            last_login_at=user.last_login_at,
            permissions=get_role_permissions(role_enum),
        )


class UserUpdateRequest(BaseModel):
    """User profile fields permissible for self-update."""
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=128)
    phone_number: Optional[str] = Field(default=None, max_length=32)


class UserStatusUpdateRequest(BaseModel):
    """Admin-only account status modification."""
    account_status: AccountStatus = Field(description="Updated account status: ACTIVE, SUSPENDED, PENDING_VERIFICATION")


class UserListResponse(BaseModel):
    """Paginated list of users for administrator inspection."""
    users: List[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
