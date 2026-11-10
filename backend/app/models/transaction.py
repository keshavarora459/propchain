"""
SQLAlchemy 2.x Entity Models for Real Estate Transactions in PropChain.
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PropertyTransaction(BaseModel):
    """Represents a conveyance agreement between buyer and seller."""
    __tablename__ = "property_transactions"

    transaction_number: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    proposed_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    transaction_type: Mapped[str] = mapped_column(String(32), nullable=False, default="SALE")
    purchase_mode: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    token_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ownership_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 4), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 13-state lifecycle
    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="PENDING_SELLER_ACCEPTANCE",
        index=True,
    )

    seller_accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    seller_rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    blockchain_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True, index=True)
    blockchain_block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    blockchain_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    property = relationship("Property", backref="transactions")
    buyer = relationship("User", foreign_keys=[buyer_id], backref="buying_transactions")
    seller = relationship("User", foreign_keys=[seller_id], backref="selling_transactions")
    status_history = relationship("TransactionStatusHistory", back_populates="transaction", cascade="all, delete-orphan")
    approvals = relationship("TransactionApproval", back_populates="transaction", cascade="all, delete-orphan")


class TransactionStatusHistory(BaseModel):
    """Audit log of transaction status transitions and reasons."""
    __tablename__ = "transaction_status_history"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("property_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[str] = mapped_column(String(40), nullable=False)
    to_status: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    transaction = relationship("PropertyTransaction", back_populates="status_history")
    changed_by = relationship("User", foreign_keys=[changed_by_user_id])
