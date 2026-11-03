"""
Pydantic v2 schemas for Document Management and Verification in PropChain.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DocumentResponse(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    uploader_user_id: uuid.UUID
    document_type: str
    title: str
    original_filename: str
    file_size: int
    mime_type: str
    document_hash: str
    is_encrypted: bool
    version: int
    status: str
    created_at: datetime
    updated_at: datetime
    review_notes: Optional[str] = None
    ocr_confidence: Optional[float] = None
    is_cross_property_duplicate: bool = False
    duplicate_property_name: Optional[str] = None
    duplicate_warning: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentProcessingResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    status: str
    extracted_text: Optional[str] = None
    candidate_fields: Optional[Dict[str, Any]] = None
    ocr_applied: bool
    processing_error: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentVerificationResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    verifier_user_id: Optional[uuid.UUID] = None
    action: str
    comments: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailResponse(DocumentResponse):
    processing: Optional[DocumentProcessingResponse] = None
    verification_history: List[DocumentVerificationResponse] = []


class DocumentActionRequest(BaseModel):
    comments: Optional[str] = Field(None, max_length=1000, description="Review remarks or reason")


class DocumentRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000, description="Mandatory rejection reason")


class DocumentCorrectionRequest(BaseModel):
    correction_notes: str = Field(..., min_length=3, max_length=1000, description="Specific instructions for correction")
