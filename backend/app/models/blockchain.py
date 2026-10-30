"""
SQLAlchemy 2.x Entity Models for Blockchain Operations, Events, and Ownership History.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class BlockchainOperation(BaseModel):
    """Tracks asynchronous EVM transaction lifecycle, status, retries, and reconciliation."""
    __tablename__ = "blockchain_operations"

    operation_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)

    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True, index=True)
    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # PENDING, SUBMITTED, CONFIRMED, FAILED, REVERTED
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING", index=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class BlockchainEvent(BaseModel):
    """Immutable log of smart contract events received from the EVM network."""
    __tablename__ = "blockchain_events"

    contract_address: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    event_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    block_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tx_hash: Mapped[str] = mapped_column(String(66), nullable=False, index=True)
    log_index: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class OwnershipEvent(BaseModel):
    """Auditable chronological record of property ownership conveyance."""
    __tablename__ = "ownership_events"

    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    new_owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    previous_owner_address: Mapped[Optional[str]] = mapped_column(String(42), nullable=True)
    new_owner_address: Mapped[str] = mapped_column(String(42), nullable=False)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False, default="INITIAL_REGISTRATION")
    blockchain_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True, index=True)
    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    property = relationship("Property", backref="ownership_events")
    previous_owner = relationship("User", foreign_keys=[previous_owner_id])
    new_owner = relationship("User", foreign_keys=[new_owner_id])

