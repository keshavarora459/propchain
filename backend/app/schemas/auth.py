"""
Pydantic v2 Schemas for Authentication and Authorization.
Enforces email validation, password matching, and role safety.
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.permissions import PUBLIC_REGISTRATION_ROLES, UserRole
from app.core.security import validate_password_strength
from app.schemas.user import UserResponse


class UserRegisterRequest(BaseModel):
    """Payload for public user registration."""
    full_name: str = Field(min_length=2, max_length=128, description="User's real full legal name")
    email: EmailStr = Field(description="Unique email address for account and notifications")
    phone_number: Optional[str] = Field(default=None, max_length=32, description="Contact phone number")
    password: str = Field(min_length=8, max_length=128, description="Account password")
    confirm_password: str = Field(min_length=8, max_length=128, description="Password confirmation")
    role: UserRole = Field(default=UserRole.BUYER, description="Requested role (BUYER or PROPERTY_OWNER)")
    terms_accepted: bool = Field(description="Explicit agreement to PropChain terms of service")

    @field_validator("role")
    @classmethod
    def validate_public_role(cls, v: UserRole) -> UserRole:
        """Prevent self-assigning privileged roles (Admin, Verifier, Legal Authority)."""
        if v not in PUBLIC_REGISTRATION_ROLES:
            allowed = ", ".join(r.value for r in PUBLIC_REGISTRATION_ROLES)
            raise ValueError(f"Self-registration is only allowed for roles: {allowed}. Privileged roles require administrative provisioning.")
        return v

    @field_validator("terms_accepted")
    @classmethod
    def validate_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must review and accept the PropChain Terms of Service to register.")
        return v

    @model_validator(mode="after")
    def validate_passwords(self) -> "UserRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        is_strong, err_msg = validate_password_strength(self.password)
        if not is_strong:
            raise ValueError(err_msg)
        return self


class UserLoginRequest(BaseModel):
    """Payload for credential authentication."""
    email: EmailStr = Field(description="Account email address")
    password: str = Field(description="Account password")


class TokenResponse(BaseModel):
    """Token response returned upon successful authentication."""
    access_token: str = Field(description="Short-lived Bearer JWT access token")
    refresh_token: str = Field(description="Cryptographic refresh token")
    token_type: str = Field(default="bearer", description="Token authentication scheme")
    expires_in: int = Field(default=900, description="Access token lifespan in seconds")
    user: UserResponse = Field(description="Authenticated user profile")


class RefreshTokenRequest(BaseModel):
    """Payload for token refresh when cookie is not used."""
    refresh_token: Optional[str] = Field(default=None, description="Refresh token (if not sent via HTTP-only cookie)")


class ChangePasswordRequest(BaseModel):
    """Payload for password change."""
    current_password: str = Field(description="Current verified password")
    new_password: str = Field(min_length=8, max_length=128, description="Desired new password")
    confirm_password: str = Field(min_length=8, max_length=128, description="Confirmation of new password")

    @model_validator(mode="after")
    def validate_new_passwords(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match.")
        if self.current_password == self.new_password:
            raise ValueError("New password must differ from current password.")
        is_strong, err_msg = validate_password_strength(self.new_password)
        if not is_strong:
            raise ValueError(err_msg)
        return self

