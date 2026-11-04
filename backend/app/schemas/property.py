"""
Pydantic v2 validation schemas for PropChain Property domain.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PropertyBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Property title")
    description: Optional[str] = Field(None, max_length=4000)
    property_type: str = Field(..., description="e.g. RESIDENTIAL, COMMERCIAL, INDUSTRIAL, AGRICULTURAL, PLOT")
    property_category: str = Field(default="RESIDENTIAL", description="e.g. APARTMENT, VILLA, OFFICE, LAND")

    # Location
    country: str = Field(default="India", max_length=100)
    state: str = Field(..., min_length=2, max_length=100)
    city: str = Field(..., min_length=2, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    locality: Optional[str] = Field(None, max_length=200)
    street_address: str = Field(..., min_length=5, max_length=500)
    postal_code: str = Field(..., min_length=3, max_length=20)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)

    # Physical measurements
    land_area: Decimal = Field(..., gt=0, description="Total land area")
    built_up_area: Optional[Decimal] = Field(None, ge=0)
    area_unit: str = Field(default="SQ_FT", description="SQ_FT, SQ_M, ACRE, HECTARE")
    bedrooms: Optional[int] = Field(None, ge=0, le=100)
    bathrooms: Optional[int] = Field(None, ge=0, le=100)
    floors: Optional[int] = Field(None, ge=0, le=150)
    construction_year: Optional[int] = Field(None, ge=1800, le=2100)
    valuation: Optional[Decimal] = Field(None, ge=0)

    # Cadastral / Legal
    survey_number: Optional[str] = Field(None, max_length=100)
    ulpin: Optional[str] = Field(None, max_length=100)
    registration_number: Optional[str] = Field(None, max_length=100)
    registry_jurisdiction: Optional[str] = Field(None, max_length=150)
    registration_date: Optional[date] = None


class PropertyCreate(PropertyBase):
    """Schema for property registration request."""
    pass


class PropertyUpdate(BaseModel):
    """Schema for updating property details."""
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    property_type: Optional[str] = None
    property_category: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    locality: Optional[str] = None
    street_address: Optional[str] = None
    postal_code: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    land_area: Optional[Decimal] = Field(None, gt=0)
    built_up_area: Optional[Decimal] = None
    area_unit: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    floors: Optional[int] = None
    construction_year: Optional[int] = None
    valuation: Optional[Decimal] = None
    survey_number: Optional[str] = None
    ulpin: Optional[str] = None
    registration_number: Optional[str] = None
    registry_jurisdiction: Optional[str] = None
    registration_date: Optional[date] = None


class PropertyStatusUpdate(BaseModel):
    """Schema for updating status or verification status."""
    status: Optional[str] = Field(None, description="ACTIVE, INACTIVE, DRAFT, UNDER_REVIEW, SOLD")
    verification_status: Optional[str] = Field(None, description="PENDING, SUBMITTED, VERIFIED, REJECTED, CORRECTION_REQUESTED, REQUIRES_CORRECTION")


class PropertyResponse(PropertyBase):
    """Schema for serialized property responses."""
    id: uuid.UUID
    property_number: str
    creator_user_id: uuid.UUID
    current_owner_id: Optional[uuid.UUID] = None
    status: str
    verification_status: str
    blockchain_property_id: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Populated owner details
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    seller_name: Optional[str] = None
    creator_name: Optional[str] = None

    # Verification document progress
    approved_documents_count: int = 0
    required_documents_count: int = 4

    # Verification details
    verified_at: Optional[datetime] = None
    verified_by_id: Optional[uuid.UUID] = None
    verified_by_name: Optional[str] = None

    # Blockchain anchoring verification details
    blockchain_tx_hash: Optional[str] = None
    anchor_tx_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    blockchain_contract_address: Optional[str] = None
    blockchain_registration_timestamp: Optional[datetime] = None
    blockchain_error: Optional[str] = None

    # Dev override for cross-property duplicate documents
    allow_duplicate_override: bool = False

    model_config = ConfigDict(from_attributes=True)


class PropertyListResponse(BaseModel):
    """Paginated response schema for property listings."""
    items: List[PropertyResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

