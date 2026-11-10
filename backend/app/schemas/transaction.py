"""
Pydantic v2 schemas for Real Estate Transactions and Approvals in PropChain.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TransactionCreate(BaseModel):
    property_id: Union[uuid.UUID, str]
    proposed_amount: Optional[Decimal] = Field(None, gt=0, description="Conveyance escrow or purchase amount")
    purchase_price: Optional[Decimal] = Field(None, gt=0, description="Alternative field for purchase price")
    currency: str = Field(default="USD", max_length=10)
    transaction_type: str = Field(default="SALE", max_length=32)
    purchase_mode: Optional[str] = Field(None, max_length=32, description="TOKEN_PURCHASE or ENTIRE_PROPERTY")
    token_quantity: Optional[int] = Field(None, ge=1, description="Number of tokens for tokenized fractional offers")
    description: Optional[str] = Field(None, max_length=2000)
    buyer_name: Optional[str] = None
    buyer_wallet: Optional[str] = None
    seller_name: Optional[str] = None
    seller_wallet: Optional[str] = None

    @model_validator(mode="after")
    def resolve_amount(self) -> "TransactionCreate":
        if self.proposed_amount is None:
            if self.purchase_price is not None:
                self.proposed_amount = self.purchase_price
            elif self.token_quantity is None:
                raise ValueError("proposed_amount or purchase_price is required and must be greater than zero")
        return self


class TransactionResponse(BaseModel):
    id: uuid.UUID
    transaction_number: str
    property_id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: uuid.UUID
    proposed_amount: Decimal
    currency: str
    transaction_type: str
    purchase_mode: str = "ENTIRE_PROPERTY"
    token_quantity: Optional[int] = None
    token_symbol: Optional[str] = None
    ownership_percentage: Optional[float] = None
    property_is_tokenized: bool = False
    description: Optional[str] = None
    status: str
    seller_accepted_at: Optional[datetime] = None
    seller_rejection_reason: Optional[str] = None
    blockchain_tx_hash: Optional[str] = None
    property_title: Optional[str] = None
    property_number: Optional[str] = None
    buyer_name: Optional[str] = None
    seller_name: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    blockchain_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionStatusHistoryResponse(BaseModel):
    id: uuid.UUID
    from_status: str
    to_status: str
    changed_by_user_id: uuid.UUID
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionApprovalResponse(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    approver_user_id: Optional[uuid.UUID] = None
    approver_role: str
    approval_type: str
    status: str
    comments: Optional[str] = None
    rejection_reason: Optional[str] = None
    actioned_at: Optional[datetime] = None
    created_at: datetime
    # Enriched transaction, parcel, and counterparty fields
    transaction_number: Optional[str] = None
    property_id: Optional[uuid.UUID] = None
    property_number: Optional[str] = None
    property_title: Optional[str] = None
    buyer_id: Optional[uuid.UUID] = None
    buyer_name: Optional[str] = None
    buyer_email: Optional[str] = None
    seller_id: Optional[uuid.UUID] = None
    seller_name: Optional[str] = None
    seller_email: Optional[str] = None
    proposed_amount: Optional[Decimal] = None
    currency: Optional[str] = None
    transaction_status: Optional[str] = None
    purchase_mode: str = "ENTIRE_PROPERTY"
    token_quantity: Optional[int] = None
    token_symbol: Optional[str] = None
    ownership_percentage: Optional[float] = None
    property_is_tokenized: bool = False

    model_config = ConfigDict(from_attributes=True)


class LegalConfirmationResponse(BaseModel):
    id: uuid.UUID
    transaction_id: uuid.UUID
    legal_authority_user_id: uuid.UUID
    registration_reference: str
    registry_jurisdiction: str
    registration_date: date
    deed_number: Optional[str] = Field(None, max_length=100, description="Official deed identifier")
    book_number: Optional[str] = Field(None, max_length=100, description="Registry archive book number")
    volume_number: Optional[str] = Field(None, max_length=100, description="Registry archive volume number")
    status: str
    evidence_reference: Optional[str] = None
    comments: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionDetailResponse(TransactionResponse):
    status_history: List[TransactionStatusHistoryResponse] = []
    approvals: List[TransactionApprovalResponse] = []
    legal_confirmation: Optional[LegalConfirmationResponse] = None


class TransactionRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000, description="Mandatory rejection reason")


class LegalConfirmationRequest(BaseModel):
    registration_reference: str = Field(..., min_length=3, max_length=100)
    registry_jurisdiction: str = Field(..., min_length=3, max_length=150)
    registration_date: date
    deed_number: Optional[str] = Field(None, max_length=100, description="Official deed identifier")
    book_number: Optional[str] = Field(None, max_length=100, description="Registry archive book number")
    volume_number: Optional[str] = Field(None, max_length=100, description="Registry archive volume number")
    evidence_reference: Optional[str] = Field(None, max_length=255)
    comments: Optional[str] = Field(None, max_length=1000)

