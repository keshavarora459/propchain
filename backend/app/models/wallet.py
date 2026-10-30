"""
SQLAlchemy 2.x Entity Model for User Wallets in PropChain.
Tracks MetaMask and EVM wallet associations and cryptographic signature verifications.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class UserWallet(BaseModel):
    """Stores verified EVM wallet addresses linked to user accounts."""
    __tablename__ = "user_wallets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wallet_address: Mapped[str] = mapped_column(
        String(42),
        nullable=False,
        index=True,
    )
    chain_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=31337,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    verification_nonce: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user = relationship("User", backref="wallets")

    __table_args__ = (
        Index("ix_user_wallets_user_address", "user_id", "wallet_address", unique=True),
    )

