"""
Pydantic v2 schemas for Ownership History and Conveyance Records in PropChain.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class OwnershipEventResponse(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    property_number: Optional[str] = None
    property_title: Optional[str] = None
    previous_owner_id: Optional[uuid.UUID] = None
    new_owner_id: uuid.UUID
    previous_owner_name: Optional[str] = None
    new_owner_name: Optional[str] = None
    previous_owner_address: Optional[str] = None
    new_owner_address: str
    transaction_id: Optional[str] = None
    event_type: str
    blockchain_tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OwnershipHistoryListResponse(BaseModel):
    items: List[OwnershipEventResponse]
    total: int

