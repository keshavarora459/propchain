"""
Repository for Property Documents database operations in PropChain.
"""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.document import (
    DocumentProcessingRecord,
    DocumentVerificationRecord,
    PropertyDocument,
)


class DocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_document(self, doc: PropertyDocument) -> PropertyDocument:
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def get_by_id(self, document_id: uuid.UUID) -> Optional[PropertyDocument]:
        stmt = (
            select(PropertyDocument)
            .options(
                joinedload(PropertyDocument.processing_records),
                joinedload(PropertyDocument.verification_records),
            )
            .where(PropertyDocument.id == document_id)
        )
        return self.db.scalars(stmt).unique().first()

    def list_by_property(self, property_id: uuid.UUID) -> List[PropertyDocument]:
        stmt = (
            select(PropertyDocument)
            .where(PropertyDocument.property_id == property_id)
            .order_by(PropertyDocument.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def save_processing_record(self, record: DocumentProcessingRecord) -> DocumentProcessingRecord:
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def save_verification_record(self, record: DocumentVerificationRecord) -> DocumentVerificationRecord:
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update(self, doc: PropertyDocument) -> PropertyDocument:
        self.db.commit()
        self.db.refresh(doc)
        return doc

