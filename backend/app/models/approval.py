"""
SQLAlchemy 2.x Entity Models for Stakeholder Approvals and Legal Registration Confirmations in PropChain.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class TransactionApproval(BaseModel):
    """Stores workflow approval requests and stakeholder actions."""
    __tablename__ = "transaction_approvals"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("property_transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approver_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approver_role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    approval_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING", index=True)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actioned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    transaction = relationship("PropertyTransaction", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approver_user_id])


class LegalRegistrationConfirmation(BaseModel):
    """
    Statutory land registration confirmation recorded by the Legal Authority.
    Platform internal approval and blockchain records do not independently establish legal ownership without this.
    """
    __tablename__ = "legal_registration_confirmations"

    transaction_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("property_transactions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    legal_authority_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    registration_reference: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    registry_jurisdiction: Mapped[str] = mapped_column(String(150), nullable=False)
    registration_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="CONFIRMED")
    evidence_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    transaction = relationship("PropertyTransaction", backref="legal_confirmation")
    legal_authority = relationship("User", foreign_keys=[legal_authority_user_id])
