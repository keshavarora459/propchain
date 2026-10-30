"""
Service layer for Document Management and Verification in PropChain.
"""
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
)
from app.core.permissions import UserRole
from app.models.document import (
    DocumentProcessingRecord,
    DocumentVerificationRecord,
    PropertyDocument,
)
from app.models.property import Property
from app.models.user import User
from app.repositories.document_repository import DocumentRepository
from app.repositories.property_repository import PropertyRepository
from app.schemas.document import (
    DocumentDetailResponse,
    DocumentProcessingResponse,
    DocumentResponse,
    DocumentVerificationResponse,
)
from app.services.document_processing_service import DocumentProcessingService
from app.services.storage_service import StorageService

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class DocumentService:
    def __init__(self, db: Session):
        self.db = db
        self.doc_repo = DocumentRepository(db)
        self.prop_repo = PropertyRepository(db)
        self.storage = StorageService()
        self.processor = DocumentProcessingService()

    def upload_document(
        self,
        property_id: uuid.UUID,
        file_content: bytes,
        original_filename: str,
        mime_type: str,
        document_type: str,
        title: str,
        current_user: User,
    ) -> DocumentResponse:
        # 1. Verify property existence
        prop = self.prop_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        # 2. Authorization: only Admin or the property owner/creator can upload
        user_role = UserRole(current_user.role)
        is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
        if user_role != UserRole.ADMIN and not is_owner:
            raise ForbiddenError("You are not authorized to upload documents for this property.")

        # 3. File validation
        ext = Path(original_filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise BadRequestError(
                f"Unsupported file format '{ext}'. Allowed formats are: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        if len(file_content) > MAX_FILE_SIZE_BYTES:
            raise BadRequestError(
                f"File size exceeds maximum permitted limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
            )

        # 4. Save encrypted file to secure storage
        storage_path, doc_hash, file_size = self.storage.save_file(
            content=file_content,
            original_filename=original_filename,
            encrypt=True,
        )

        # 5. Create database document entity
        doc = PropertyDocument(
            property_id=property_id,
            uploader_user_id=current_user.id,
            document_type=document_type.upper(),
            title=title,
            original_filename=original_filename,
            storage_path=storage_path,
            file_size=file_size,
            mime_type=mime_type or "application/octet-stream",
            document_hash=doc_hash,
            is_encrypted=True,
            version=1,
            status="PENDING_REVIEW",
        )
        created_doc = self.doc_repo.create_document(doc)

        # 6. Process document text and candidate legal metadata
        extracted_text, candidate_fields, ocr_applied, proc_status = self.processor.process_document(
            content=file_content,
            filename=original_filename,
            mime_type=mime_type,
        )

        proc_record = DocumentProcessingRecord(
            document_id=created_doc.id,
            status=proc_status,
            extracted_text=extracted_text or None,
            candidate_fields=candidate_fields or None,
            ocr_applied=ocr_applied,
        )
        self.doc_repo.save_processing_record(proc_record)

        return DocumentResponse.model_validate(created_doc)

    def list_documents_for_property(
        self,
        property_id: uuid.UUID,
        current_user: User,
    ) -> List[DocumentResponse]:
        prop = self.prop_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        docs = self.doc_repo.list_by_property(property_id)
        return [DocumentResponse.model_validate(d) for d in docs]

    def get_document_detail(
        self,
        document_id: uuid.UUID,
        current_user: User,
    ) -> DocumentDetailResponse:
        doc = self.doc_repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError(f"Document with ID '{document_id}' not found.")

        processing = None
        if doc.processing_records:
            processing = DocumentProcessingResponse.model_validate(doc.processing_records[0])

        verifications = [
            DocumentVerificationResponse.model_validate(v)
            for v in (doc.verification_records or [])
        ]

        resp = DocumentDetailResponse.model_validate(doc)
        resp.processing = processing
        resp.verification_history = verifications
        return resp

    def download_document(
        self,
        document_id: uuid.UUID,
        current_user: User,
    ) -> Tuple[bytes, str, str]:
        doc = self.doc_repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError(f"Document with ID '{document_id}' not found.")

        content = self.storage.read_file(doc.storage_path, is_encrypted=doc.is_encrypted)
        return content, doc.original_filename, doc.mime_type

    def action_document(
        self,
        document_id: uuid.UUID,
        action: str,
        comments: Optional[str],
        current_user: User,
    ) -> DocumentResponse:
        user_role = UserRole(current_user.role)
        if user_role not in {UserRole.ADMIN, UserRole.VERIFIER, UserRole.LEGAL_AUTHORITY}:
            raise ForbiddenError("Only authorized verifiers or legal authorities can review documents.")

        doc = self.doc_repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError(f"Document with ID '{document_id}' not found.")

        doc.status = action
        self.doc_repo.update(doc)

        # Audit verification history
        v_record = DocumentVerificationRecord(
            document_id=doc.id,
            verifier_user_id=current_user.id,
            action=action,
            comments=comments,
        )
        self.doc_repo.save_verification_record(v_record)

        # Check if all documents for the property are verified
        all_docs = self.doc_repo.list_by_property(doc.property_id)
        if all(d.status == "VERIFIED" for d in all_docs) and len(all_docs) > 0:
            prop = self.prop_repo.get_by_id(doc.property_id)
            if prop and prop.verification_status != "VERIFIED":
                prop.verification_status = "VERIFIED"
                self.prop_repo.update(prop)

        return DocumentResponse.model_validate(doc)

