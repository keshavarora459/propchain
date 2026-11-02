"""
Document Management & Verification API Endpoints for PropChain.
"""
import uuid
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.dependencies.auth import get_current_user
from app.dependencies.permissions import require_permission
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.document import (
    DocumentActionRequest,
    DocumentCorrectionRequest,
    DocumentDetailResponse,
    DocumentRejectRequest,
    DocumentResponse,
)
from app.services.document_service import DocumentService

router = APIRouter(tags=["Documents"])


@router.post(
    "/properties/{property_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and process a property deed or identity document",
)
async def upload_document(
    property_id: uuid.UUID,
    file: UploadFile = File(...),
    document_type: str = Form("SALE_DEED"),
    title: str = Form("Property Document"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    content = await file.read()
    return service.upload_document(
        property_id=property_id,
        file_content=content,
        original_filename=file.filename or "uploaded_file.bin",
        mime_type=file.content_type or "application/octet-stream",
        document_type=document_type,
        title=title,
        current_user=current_user,
    )


@router.get(
    "/properties/{property_id}/documents",
    response_model=List[DocumentResponse],
    summary="List all documents associated with a property",
)
def list_property_documents(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    return service.list_documents_for_property(property_id, current_user)


@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Retrieve document metadata, extracted OCR text, and verification history",
)
def get_document_details(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    return service.get_document_detail(document_id, current_user)


@router.get(
    "/documents/{document_id}/download",
    summary="Download decrypted document bytes (Authorized stakeholders only)",
)
def download_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    content, filename, mime_type = service.download_document(document_id, current_user)
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/documents/{document_id}/verify",
    response_model=DocumentResponse,
    summary="Approve and mark a document as VERIFIED (Verifier or Admin)",
)
def verify_document(
    document_id: uuid.UUID,
    payload: DocumentActionRequest = DocumentActionRequest(),
    current_user: User = Depends(require_permission(Permission.VERIFY_DOCUMENTS)),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    return service.action_document(
        document_id=document_id,
        action="VERIFIED",
        comments=payload.comments,
        current_user=current_user,
    )


@router.post(
    "/documents/{document_id}/reject",
    response_model=DocumentResponse,
    summary="Reject document with mandatory reason (Verifier or Admin)",
)
def reject_document(
    document_id: uuid.UUID,
    payload: DocumentRejectRequest,
    current_user: User = Depends(require_permission(Permission.VERIFY_DOCUMENTS)),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    return service.action_document(
        document_id=document_id,
        action="REJECTED",
        comments=payload.reason,
        current_user=current_user,
    )


@router.post(
    "/documents/{document_id}/request-correction",
    response_model=DocumentResponse,
    summary="Flag document as REQUIRES_CORRECTION with instructions",
)
def request_document_correction(
    document_id: uuid.UUID,
    payload: DocumentCorrectionRequest,
    current_user: User = Depends(require_permission(Permission.VERIFY_DOCUMENTS)),
    db: Session = Depends(get_db),
):
    service = DocumentService(db)
    return service.action_document(
        document_id=document_id,
        action="REQUIRES_CORRECTION",
        comments=payload.correction_notes,
        current_user=current_user,
    )

