"""
Service layer for Document Management and Verification in PropChain.
"""
import hashlib
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy import select
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
        if user_role in {UserRole.VERIFIER.value, "VERIFIER"}:
            raise ForbiddenError("Verifiers are not authorized to upload documents.")

        is_owner = (
            (prop.current_owner_id is not None and str(prop.current_owner_id) == str(current_user.id))
            or (prop.creator_user_id is not None and str(prop.creator_user_id) == str(current_user.id))
        )
        if user_role != UserRole.ADMIN.value and not is_owner:
            raise ForbiddenError("You are not authorized to upload documents for this property.")

        if prop.verification_status == "SUBMITTED":
            raise BadRequestError(
                "Uploading is locked while property is under verifier review. Await reviewer action or correction request."
            )

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

        # Item 3: Check cross-property duplicate
        other_doc = self.db.scalars(
            select(PropertyDocument).where(
                PropertyDocument.document_hash == doc_hash,
                PropertyDocument.property_id != property_id,
                PropertyDocument.status.not_in(["REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"]),
            )
        ).first()
        duplicate_info = None
        if other_doc:
            other_p = self.prop_repo.get_by_id(other_doc.property_id)
            p_name = other_p.title if other_p else str(other_doc.property_id)
            duplicate_info = {
                "cross_property_duplicate": True,
                "duplicate_property_id": str(other_doc.property_id),
                "duplicate_property_name": p_name,
            }

        # 10. Process document text and candidate legal metadata
        extracted_text, candidate_fields, ocr_applied, proc_status = self.processor.process_document(
            content=file_content,
            filename=original_filename,
            mime_type=mime_type,
        )

        if candidate_fields is None:
            candidate_fields = {}
        if duplicate_info:
            candidate_fields.update(duplicate_info)

        proc_record = DocumentProcessingRecord(
            document_id=created_doc.id,
            status=proc_status,
            extracted_text=extracted_text or None,
            candidate_fields=candidate_fields or None,
            ocr_applied=ocr_applied,
        )
        self.doc_repo.save_processing_record(proc_record)

        resp = DocumentResponse.model_validate(created_doc)
        if duplicate_info:
            resp.is_cross_property_duplicate = True
            resp.duplicate_property_name = duplicate_info["duplicate_property_name"]
            resp.duplicate_warning = f"Duplicate of another property ({duplicate_info['duplicate_property_name']})"
        return resp

    def _enrich_document_response(
        self,
        resp: DocumentResponse,
        doc: PropertyDocument,
        current_user: User,
    ) -> None:
        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        is_verifier_or_admin = user_role in {UserRole.VERIFIER.value, UserRole.ADMIN.value, "VERIFIER", "ADMIN"}

        # Item 3: Cross-property duplicate check
        if is_verifier_or_admin:
            d_hash = (doc.document_hash or "").lower()
            other_doc = self.db.scalars(
                select(PropertyDocument).where(
                    PropertyDocument.document_hash == d_hash,
                    PropertyDocument.property_id != doc.property_id,
                    PropertyDocument.status.not_in(["REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"]),
                )
            ).first()
            if other_doc:
                other_p = self.prop_repo.get_by_id(other_doc.property_id)
                p_name = other_p.title if other_p else "another property"
                resp.is_cross_property_duplicate = True
                resp.duplicate_property_name = p_name
                resp.duplicate_warning = f"Duplicate of another property ({p_name})"

        # Item 2: OCR confidence only to VERIFIER and ADMIN
        if is_verifier_or_admin and doc.processing_records:
            rec = doc.processing_records[0]
            if rec.status == "SUCCESS" and rec.extracted_text and len(rec.extracted_text.strip()) > 10:
                real_fields = [k for k in (rec.candidate_fields or {}) if not str(k).startswith("duplicate") and k != "cross_property_duplicate"]
                if len(real_fields) >= 3:
                    resp.ocr_confidence = 94.5
                elif len(real_fields) >= 1:
                    resp.ocr_confidence = 88.0
                elif rec.ocr_applied:
                    resp.ocr_confidence = 82.5
                else:
                    resp.ocr_confidence = 79.0
            else:
                resp.ocr_confidence = None
        else:
            resp.ocr_confidence = None

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
        if user_role in {UserRole.VERIFIER.value, "VERIFIER"} and prop.verification_status == "PENDING":
            raise ForbiddenError("Access denied: Draft properties cannot be viewed by verifiers until submitted.")

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
            self._enrich_document_response(resp, d, current_user)
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
        self._enrich_document_response(resp, doc, current_user)
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
        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        if user_role not in {UserRole.VERIFIER.value, "VERIFIER"}:
            raise ForbiddenError("Only role VERIFIER can review or verify documents.")

        doc = self.doc_repo.get_by_id(document_id)
        if not doc:
            raise NotFoundError(f"Document with ID '{document_id}' not found.")

        prop = self.prop_repo.get_by_id(doc.property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{doc.property_id}' not found.")

        # Verifiers cannot review draft properties that have not been submitted
        if user_role in {UserRole.VERIFIER.value, "VERIFIER"} and prop.verification_status == "PENDING":
            raise ForbiddenError("Cannot review documents for draft properties that have not been submitted for verification.")

        # Item 4: Disable and reject action on documents in Needs correction or Replaced status
        curr_status = (doc.status or "").upper()
        if curr_status in {"CORRECTION_REQUESTED", "REQUIRES_CORRECTION", "REPLACED"}:
            raise BadRequestError(
                f"Cannot action document in '{doc.status}' state. "
                "Awaiting seller to upload a new replacement document before new review."
            )

        norm_action = action.upper()

        # Item 3: A verifier must not be able to verify while cross-property duplicate flag is unresolved
        if norm_action == "VERIFIED":
            d_hash = (doc.document_hash or "").lower()
            other_doc = self.db.scalars(
                select(PropertyDocument).where(
                    PropertyDocument.document_hash == d_hash,
                    PropertyDocument.property_id != doc.property_id,
                    PropertyDocument.status.not_in(["REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"]),
                )
            ).first()
            if other_doc:
                other_p = self.prop_repo.get_by_id(other_doc.property_id)
                p_name = other_p.title if other_p else "another property"
                # DEV ONLY: remove or set false before production.
                from app.core.config import get_settings
                settings = get_settings()
                if settings.ALLOW_DUPLICATE_DOCS_ON_VERIFY and settings.APP_ENV == "development":
                    logger.warning(
                        "DEV OVERRIDE: Allowing document verification with duplicate document '%s' (duplicates property '%s').",
                        doc.title or doc.document_type,
                        p_name,
                    )
                else:
                    raise BadRequestError(
                        f"Cannot approve document with unresolved cross-property duplicate. "
                        f"This file is a duplicate of {p_name}. You must request correction or reject it."
                    )
        if norm_action in {"REQUIRES_CORRECTION", "CORRECTION_REQUESTED"}:
            doc.status = "CORRECTION_REQUESTED"
            prop.verification_status = "CORRECTION_REQUESTED"
            self.prop_repo.update(prop)

            # Notify seller
            try:
                from app.models.user_activity import UserActivityLog
                seller_id = prop.creator_user_id or prop.current_owner_id
                if seller_id:
                    notif = UserActivityLog(
                        user_id=seller_id,
                        activity_type="NOTIFICATION",
                        description=f"Correction requested on {doc.document_type} for property {prop.title}: {comments or 'Please re-upload a clear copy.'}",
                    )
                    self.db.add(notif)
                    self.db.commit()
            except Exception:
                pass
        elif norm_action == "REJECTED":
            doc.status = "REJECTED"
            prop.verification_status = "CORRECTION_REQUESTED"
            self.prop_repo.update(prop)

            # Notify seller
            try:
                from app.models.user_activity import UserActivityLog
                seller_id = prop.creator_user_id or prop.current_owner_id
                if seller_id:
                    notif = UserActivityLog(
                        user_id=seller_id,
                        activity_type="NOTIFICATION",
                        description=f"Document {doc.document_type} for property {prop.title} was rejected: {comments or 'Rejected by reviewer.'}",
                    )
                    self.db.add(notif)
                    self.db.commit()
            except Exception:
                pass
        elif norm_action == "VERIFIED":
            doc.status = "VERIFIED"
        else:
            doc.status = norm_action

        self.doc_repo.update(doc)

        # Audit verification history
        v_record = DocumentVerificationRecord(
            document_id=doc.id,
            verifier_user_id=current_user.id,
            action=doc.status,
            comments=comments,
        )
        self.doc_repo.save_verification_record(v_record)

        # When the last (4th) document is approved, notify seller and verifier
        if norm_action == "VERIFIED":
            try:
                approved_count = self.db.query(PropertyDocument).filter(
                    PropertyDocument.property_id == prop.id,
                    PropertyDocument.status == "VERIFIED",
                ).count()
                if approved_count >= 4:
                    from app.models.user_activity import UserActivityLog
                    seller_id = prop.creator_user_id or prop.current_owner_id
                    if seller_id:
                        seller_notif = UserActivityLog(
                            user_id=seller_id,
                            activity_type="NOTIFICATION",
                            description=f"All documents approved, final verification pending for {prop.title} ({prop.property_number})",
                        )
                        self.db.add(seller_notif)

                    verifier_notif = UserActivityLog(
                        user_id=current_user.id,
                        activity_type="NOTIFICATION",
                        description=f"Property is ready to verify: {prop.title} ({prop.property_number})",
                    )
                    self.db.add(verifier_notif)
                    self.db.commit()
            except Exception as notif_err:
                logger.warning("Notification on 4th doc approval notice: %s", notif_err)

        return DocumentResponse.model_validate(doc)
