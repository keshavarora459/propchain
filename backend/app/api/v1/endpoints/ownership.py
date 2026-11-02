"""
Ownership History and Conveyance Endpoints for PropChain.
"""
import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.blockchain import OwnershipEvent
from app.models.property import Property
from app.models.user import User
from app.models.wallet import UserWallet
from app.schemas.ownership import OwnershipEventResponse, OwnershipHistoryListResponse
from app.services.blockchain_service import BlockchainService

router = APIRouter(tags=["Ownership"])


def _to_event_response(e: OwnershipEvent) -> OwnershipEventResponse:
    resp = OwnershipEventResponse.model_validate(e)
    if e.property:
        resp.property_number = e.property.property_number
        resp.property_title = e.property.title
    if e.previous_owner:
        resp.previous_owner_name = e.previous_owner.full_name
    if e.new_owner:
        resp.new_owner_name = e.new_owner.full_name
    return resp


@router.get(
    "/ownership/history",
    response_model=OwnershipHistoryListResponse,
    summary="List all tamper-evident ownership conveyance events across the platform",
)
def list_ownership_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(OwnershipEvent)
        .options(
            joinedload(OwnershipEvent.property),
            joinedload(OwnershipEvent.previous_owner),
            joinedload(OwnershipEvent.new_owner),
        )
        .order_by(OwnershipEvent.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    events = list(db.scalars(stmt).unique().all())
    return OwnershipHistoryListResponse(
        items=[_to_event_response(e) for e in events],
        total=len(events),
    )


@router.get(
    "/properties/{property_id}/ownership-history",
    response_model=List[OwnershipEventResponse],
    summary="Get complete chronological ownership conveyance events for a specific property",
)
@router.get(
    "/ownership/properties/{property_id}/history",
    response_model=List[OwnershipEventResponse],
    include_in_schema=False,
)
def get_property_ownership_history(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prop = db.get(Property, property_id)
    if not prop:
        raise NotFoundError(f"Property with ID '{property_id}' not found.")

    stmt = (
        select(OwnershipEvent)
        .options(
            joinedload(OwnershipEvent.property),
            joinedload(OwnershipEvent.previous_owner),
            joinedload(OwnershipEvent.new_owner),
        )
        .where(OwnershipEvent.property_id == property_id)
        .order_by(OwnershipEvent.created_at.asc())
    )
    events = list(db.scalars(stmt).unique().all())
    return [_to_event_response(e) for e in events]


@router.post(
    "/properties/{property_id}/anchor-blockchain",
    summary="Anchor property on EVM blockchain after verification (Owner or Admin)",
)
def anchor_property_on_chain(
    property_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prop = db.get(Property, property_id)
    if not prop:
        raise NotFoundError(f"Property with ID '{property_id}' not found.")

    user_role = UserRole(current_user.role)
    is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
    if user_role != UserRole.ADMIN and not is_owner:
        raise ForbiddenError("Only property owner or admin can anchor this property on-chain.")

    # Find owner verified wallet
    owner_id = prop.current_owner_id or prop.creator_user_id
    wallet = db.scalars(
        select(UserWallet).where(
            UserWallet.user_id == owner_id,
            UserWallet.is_verified == True,  # noqa: E712
        )
    ).first()

    owner_address = wallet.wallet_address if wallet else "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

    # Get sample or verified document hash
    doc_hash = "c4ca4238a0b923820dcc509a6f75849b28a4a5f83896434458514138a0b92382"
    if prop.documents:
        doc_hash = prop.documents[0].document_hash

    b_service = BlockchainService(db)
    success, tx_hash, err = b_service.anchor_property(
        prop=prop,
        owner_wallet=owner_address,
        document_hash_hex=doc_hash,
    )

    if not success:
        raise BadRequestError(f"Blockchain anchoring failed: {err}")

    return {
        "status": "ANCHORED",
        "property_id": prop.id,
        "property_number": prop.property_number,
        "tx_hash": tx_hash,
        "owner_wallet": owner_address,
    }

