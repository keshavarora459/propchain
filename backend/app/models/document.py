"""
SQLAlchemy 2.x Entity Models for Document Management & Verification in PropChain.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PropertyDocument(BaseModel):
    """Represents a deed, tax receipt, identity proof, or legal document for a property."""
    __tablename__ = "property_documents"

    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploader_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Document classification & identification
    document_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Cryptographic integrity and encryption
    document_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Lifecycle status: UPLOADED, PROCESSING, PENDING_REVIEW, VERIFIED, REJECTED, REQUIRES_CORRECTION
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="UPLOADED", index=True)

    # Relationships
    property = relationship("Property", backref="documents")
    uploader = relationship("User", foreign_keys=[uploader_user_id], backref="uploaded_documents")
    processing_records = relationship("DocumentProcessingRecord", back_populates="document", cascade="all, delete-orphan")
    verification_records = relationship("DocumentVerificationRecord", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_documents_property_status", "property_id", "status"),
    )


class DocumentProcessingRecord(BaseModel):
    """Audit log of OCR and digital text extraction attempts and candidate metadata."""
    __tablename__ = "document_processing_records"

    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("property_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="SUCCESS")
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    candidate_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ocr_applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    document = relationship("PropertyDocument", back_populates="processing_records")


class DocumentVerificationRecord(BaseModel):
    """Audit trail of verifier actions, comments, and outcomes."""
    __tablename__ = "document_verification_records"

    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("property_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    verifier_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    document = relationship("PropertyDocument", back_populates="verification_records")
    verifier = relationship("User", foreign_keys=[verifier_user_id])

