"""
User SQLAlchemy Model for PropChain.
Represents platform identity, roles, and account statuses.
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.permissions import AccountStatus, UserRole
from app.models.base import BaseModel


class User(BaseModel):
    """User account entity model."""
    __tablename__ = "users"

    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    role: Mapped[str] = mapped_column(
        String(32),
        default=UserRole.BUYER.value,
        index=True,
        nullable=False,
    )

    account_status: Mapped[str] = mapped_column(
        String(32),
        default=AccountStatus.ACTIVE.value,
        index=True,
        nullable=False,
    )

    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    activity_logs: Mapped[List["UserActivityLog"]] = relationship(
        "UserActivityLog",
        back_populates="user",
    )

