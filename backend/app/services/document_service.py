"""
Service layer for Document Management and Verification in PropChain.
"""
import hashlib
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
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

INACTIVE_OR_REPLACED_STATUSES = {
    "REJECTED",
    "CORRECTION_REQUESTED",
    "REQUIRES_CORRECTION",
    "REPLACED",
}


def are_same_document_type(type_a: str, type_b: str) -> bool:
    a = (type_a or "").strip().upper()
    b = (type_b or "").strip().upper()
    if not a or not b:
        return False
    if a == b:
        return True
    from app.services.property_service import REQUIRED_PROPERTY_DOC_SPECS
    for spec in REQUIRED_PROPERTY_DOC_SPECS:
        aliases = {alias.upper() for alias in spec.get("aliases", set())}
        aliases.add(spec["type"].upper())
        if a in aliases and b in aliases:
            return True
    return False


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
        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
        if user_role != UserRole.ADMIN.value and not is_owner:
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

        # 4. Compute file hash of unencrypted original bytes
        file_hash = hashlib.sha256(file_content).hexdigest().lower()

        # 5. Retrieve existing documents for the same property
        existing_docs = self.doc_repo.list_by_property(property_id)

        # 6. Requirement 1: Compare SHA-256 with existing documents of the SAME property.
        # If hash already exists and not REJECTED / CORRECTION_REQUESTED / REPLACED, reject with 409
        for d in existing_docs:
            d_hash = (d.document_hash or "").lower()
            if d_hash == file_hash and (d.status or "").upper() not in INACTIVE_OR_REPLACED_STATUSES:
                raise ConflictError("This file is already uploaded for this property.")

        # 7. Requirement 2: Only one active document per type per property.
        # A new upload of the same type is allowed ONLY if the existing one is REJECTED or CORRECTION_REQUESTED.
        # Then mark the old one as REPLACED (keep it for history) and the new one becomes active.
        norm_type = (document_type or "TITLE_DEED").strip().upper()
        same_type_docs = [
            d for d in existing_docs
            if are_same_document_type(d.document_type, norm_type)
        ]
        active_same_type_docs = [
            d for d in same_type_docs
            if (d.status or "").upper() not in INACTIVE_OR_REPLACED_STATUSES
        ]
        if active_same_type_docs:
            raise ConflictError(
                f"An active document of type '{document_type}' is already uploaded for this property. "
                "A replacement is only allowed if the document requires correction or was rejected."
            )

        # Mark previous same-type documents (which were rejected or correction requested) as REPLACED
        for old_doc in same_type_docs:
            if (old_doc.status or "").upper() in {"REJECTED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}:
                old_doc.status = "REPLACED"
                self.doc_repo.update(old_doc)

        max_version = max([d.version for d in same_type_docs], default=0)
        next_version = (max_version + 1) if max_version > 0 else 1

        # 8. Save encrypted file to secure storage
        storage_path, doc_hash, file_size = self.storage.save_file(
            content=file_content,
            original_filename=original_filename,
            encrypt=True,
        )

        # 9. Create database document entity
        doc = PropertyDocument(
            property_id=property_id,
            uploader_user_id=current_user.id,
            document_type=norm_type,
            title=title,
            original_filename=original_filename,
            storage_path=storage_path,
            file_size=file_size,
            mime_type=mime_type or "application/octet-stream",
            document_hash=doc_hash,
            is_encrypted=True,
            version=next_version,
            status="PENDING_REVIEW",
        )
        created_doc = self.doc_repo.create_document(doc)

        # 10. Process document text and candidate legal metadata
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

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        if user_role == UserRole.PROPERTY_OWNER.value:
            is_owner = (prop.current_owner_id == current_user.id) or (prop.creator_user_id == current_user.id)
            if not is_owner:
                raise ForbiddenError("Access denied: You can only view documents for your own properties.")

        docs = self.doc_repo.list_by_property(property_id)
        results = []
        for d in docs:
            resp = DocumentResponse.model_validate(d)
            d_status = (d.status or "").upper()
            if d_status in {"REJECTED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}:
                if d.verification_records:
                    resp.review_notes = d.verification_records[-1].comments or "Correction requested by title reviewer."
                else:
                    resp.review_notes = "Correction requested by title reviewer."
            results.append(resp)
        return results

    def get_document_detail(
        self,
        document_id: uuid.UUID,
        current_user: User,
    ) -> DocumentDetailResponse:
        doc = self.doc_repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError(f"Document with ID '{document_id}' not found.")

        prop = self.prop_repo.get_by_id(doc.property_id)
        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)

        if user_role == UserRole.PROPERTY_OWNER.value:
            is_owner = (doc.uploader_user_id == current_user.id) or (
                prop and ((prop.current_owner_id == current_user.id) or (prop.creator_user_id == current_user.id))
            )
            if not is_owner:
                raise ForbiddenError("Access denied: You can only view documents for your own properties.")

        processing = None
        # Never leak verifier OCR internal records or candidate metadata to property owners
        if user_role != UserRole.PROPERTY_OWNER.value and doc.processing_records:
            processing = DocumentProcessingResponse.model_validate(doc.processing_records[0])

        verifications = []
        if user_role == UserRole.PROPERTY_OWNER.value:
            # For property owners, only expose clean review notes if actioned with correction or rejection
            if doc.status in ["REJECTED", "REQUIRES_CORRECTION", "CORRECTION_REQUESTED"] and doc.verification_records:
                for v in doc.verification_records:
                    verifications.append(
                        DocumentVerificationResponse(
                            id=v.id,
                            document_id=v.document_id,
                            verifier_user_id=None,
                            action=v.action,
                            comments=v.comments or "Correction requested by title reviewer.",
                            created_at=v.created_at,
                        )
                    )
        else:
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

        prop = self.prop_repo.get_by_id(doc.property_id)
        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)

        if user_role == UserRole.PROPERTY_OWNER.value:
            is_owner = (doc.uploader_user_id == current_user.id) or (
                prop and ((prop.current_owner_id == current_user.id) or (prop.creator_user_id == current_user.id))
            )
            if not is_owner:
                raise ForbiddenError("Access denied: You can only download documents for your own properties.")

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

        # Check if all active documents for the property are verified
        all_docs = self.doc_repo.list_by_property(doc.property_id)
        active_docs = [d for d in all_docs if (d.status or "").upper() != "REPLACED"]
        if active_docs and all(d.status == "VERIFIED" for d in active_docs):
            prop = self.prop_repo.get_by_id(doc.property_id)
            if prop and prop.verification_status != "VERIFIED":
                prop.verification_status = "VERIFIED"
                self.prop_repo.update(prop)

        return DocumentResponse.model_validate(doc)
