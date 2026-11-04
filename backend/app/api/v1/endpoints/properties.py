"""
Property Management API Endpoints for PropChain.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.permissions import require_permission
from app.models.user import User
from pydantic import BaseModel
from app.schemas.property import (
    PropertyCreate,
    PropertyListResponse,
    PropertyResponse,
    PropertyStatusUpdate,
    PropertyUpdate,
)
from app.services.property_service import PropertyService

router = APIRouter(prefix="/properties", tags=["Properties"])


@router.post(
    "",
    response_model=PropertyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new property",
)
def register_property(
    payload: PropertyCreate,
    current_user: User = Depends(require_permission(Permission.REGISTER_PROPERTY)),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.register_property(payload, current_user)


@router.get(
    "",
    response_model=PropertyListResponse,
    summary="List and search properties with filtering and pagination",
)
def list_properties(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search query across title, address, identifiers"),
    property_type: Optional[str] = Query(None, description="Filter by type (RESIDENTIAL, COMMERCIAL, etc.)"),
    status: Optional[str] = Query(None, description="Filter by status (ACTIVE, INACTIVE, etc.)"),
    verification_status: Optional[str] = Query(None, description="Filter by verification status"),
    state: Optional[str] = Query(None, description="Filter by state"),
    city: Optional[str] = Query(None, description="Filter by city"),
    mine: Optional[bool] = Query(False, description="Filter only properties owned or created by current user"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.list_properties(
        page=page,
        page_size=page_size,
        search=search,
        property_type=property_type,
        status=status,
        verification_status=verification_status,
        state=state,
        city=city,
        mine=mine,
        current_user=current_user,
    )


@router.get(
    "/my",
    response_model=PropertyListResponse,
    summary="List properties owned or registered by the current user",
)
def list_my_properties(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.list_my_properties(
        current_user=current_user,
        page=page,
        page_size=page_size,
        status=status,
    )


@router.get(
    "/{property_id}",
    response_model=PropertyResponse,
    summary="Retrieve details of a specific property",
)
def get_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.get_property(property_id, current_user=current_user)


@router.delete(
    "/{property_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a property (Admin or Property Owner)",
)
def delete_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    service.delete_property(property_id, current_user=current_user)
    return {"success": True, "message": "Property deleted successfully."}


@router.patch(
    "/{property_id}",
    response_model=PropertyResponse,
    summary="Update property information (Authorized owner or admin only)",
)
def update_property(
    property_id: uuid.UUID,
    payload: PropertyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.update_property(property_id, payload, current_user)


@router.patch(
    "/{property_id}/status",
    response_model=PropertyResponse,
    summary="Update operational or verification status",
)
def update_property_status(
    property_id: uuid.UUID,
    payload: PropertyStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.update_status(property_id, payload, current_user)


@router.post(
    "/{property_id}/submit-for-verification",
    response_model=PropertyResponse,
    summary="Submit property for verifier review once all required documents are uploaded",
)
def submit_for_verification(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.submit_for_verification(property_id, current_user)


@router.post(
    "/{property_id}/verify",
    response_model=PropertyResponse,
    summary="Approve all 4 documents and verify property, anchoring on blockchain (Verifier or Admin)",
)
def verify_property(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.verify_property(property_id, current_user)


class RejectPropertyRequest(BaseModel):
    reason: Optional[str] = None


@router.post(
    "/{property_id}/reject",
    response_model=PropertyResponse,
    summary="Reject property verification (Verifier or Admin)",
)
def reject_property(
    property_id: uuid.UUID,
    payload: Optional[RejectPropertyRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    reason = payload.reason if payload else None
    return service.reject_property(property_id, reason, current_user)


@router.post(
    "/{property_id}/submit",
    response_model=PropertyResponse,
    summary="Alias for submit property for verification",
    include_in_schema=False,
)
def submit_property_alias(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.submit_for_verification(property_id, current_user)


@router.get(
    "/{property_id}/required-documents",
    summary="Check checklist of required documents for property verification",
)
def get_required_documents_status(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.get_required_documents_status(property_id, current_user)


@router.post(
    "/{property_id}/retry-blockchain",
    response_model=PropertyResponse,
    summary="Retry anchoring verified property on blockchain (Owner, Verifier, or Admin)",
)
def retry_blockchain_registration(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = PropertyService(db)
    return service.retry_blockchain_registration(property_id, current_user)
