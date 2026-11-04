"""
SQLAlchemy 2.x Entity Model for Properties in PropChain.
Represents registered land parcels and real estate assets.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Property(BaseModel):
    """
    Property domain entity storing physical, geographic, legal, and operational attributes.
    """
    __tablename__ = "properties"

    # Human-readable unique system identifier (e.g. PROP-2026-98124)
    property_number: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    # Basic attributes
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    property_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    property_category: Mapped[str] = mapped_column(String(64), nullable=False, default="RESIDENTIAL")

    # Location attributes
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="India")
    state: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    locality: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    street_address: Mapped[str] = mapped_column(String(500), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)

    # Physical measurements
    land_area: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    built_up_area: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    area_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="SQ_FT")
    bedrooms: Mapped[Optional[int]] = mapped_column(nullable=True)
    bathrooms: Mapped[Optional[int]] = mapped_column(nullable=True)
    floors: Mapped[Optional[int]] = mapped_column(nullable=True)
    construction_year: Mapped[Optional[int]] = mapped_column(nullable=True)
    valuation: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)

    # Cadastral / Legal Registry attributes (jurisdiction-flexible)
    survey_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    ulpin: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    registration_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    registry_jurisdiction: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    registration_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Ownership & Operational state
    creator_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    current_owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE", index=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="PENDING",
        index=True,
    )

    # Verification details
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Blockchain anchoring reference
    blockchain_property_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        index=True,
    )
    blockchain_tx_hash: Mapped[Optional[str]] = mapped_column(
        String(66),
        nullable=True,
        index=True,
    )
    blockchain_block_number: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    blockchain_anchored_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    creator = relationship("User", foreign_keys=[creator_user_id], backref="created_properties")
    current_owner = relationship("User", foreign_keys=[current_owner_id], backref="owned_properties")
    verified_by = relationship("User", foreign_keys=[verified_by_id], backref="verified_properties")

    __table_args__ = (
        Index("ix_properties_state_city_type", "state", "city", "property_type"),
        Index("ix_properties_status_verification", "status", "verification_status"),
    )

