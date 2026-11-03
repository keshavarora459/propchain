"""
Ownership History and Conveyance Endpoints for PropChain.
"""
import uuid
from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.permissions import UserRole, assert_property_access
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.blockchain import OwnershipEvent
from app.models.property import Property
from app.models.user import User
from app.models.wallet import UserWallet
from app.models.document import PropertyDocument
from app.models.transaction import PropertyTransaction
from sqlalchemy import or_
import hashlib
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
    )
    raw_role = current_user.role
    user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
    if user_role == UserRole.PROPERTY_OWNER.value:
        stmt = stmt.outerjoin(Property, OwnershipEvent.property_id == Property.id).where(
            or_(
                OwnershipEvent.previous_owner_id == current_user.id,
                OwnershipEvent.new_owner_id == current_user.id,
                Property.current_owner_id == current_user.id,
                Property.creator_user_id == current_user.id,
            )
        )
    elif user_role == UserRole.BUYER.value:
        stmt = stmt.where(
            or_(
                OwnershipEvent.previous_owner_id == current_user.id,
                OwnershipEvent.new_owner_id == current_user.id,
            )
        )
    stmt = stmt.offset(skip).limit(limit)
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

    assert_property_access(current_user, prop, allow_marketplace=True)

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

    assert_property_access(current_user, prop, allow_marketplace=True)

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

    # Get verified or computed property document hash
    doc_hash = hashlib.sha256(f"{prop.property_number}:{prop.id}".encode()).hexdigest()
    if prop.documents and prop.documents[0].document_hash:
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



@router.get(
    "/blockchain/my-records",
    summary="Retrieve current user's blockchain-relevant identifiers and hashes for scoping",
)
@router.get(
    "/ownership/my-records",
    include_in_schema=False,
)
def get_user_blockchain_records(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns property numbers, document hashes, tx hashes, and wallet addresses for current user."""
    # 1. Properties
    user_props = list(
        db.scalars(
            select(Property).where(
                or_(
                    Property.current_owner_id == current_user.id,
                    Property.creator_user_id == current_user.id,
                )
            )
        ).all()
    )
    property_ids = [p.property_number for p in user_props if p.property_number]
    property_uuids = [str(p.id) for p in user_props]
    blockchain_property_ids = [p.blockchain_property_id for p in user_props if p.blockchain_property_id]

    # 2. Document hashes
    prop_uuid_list = [p.id for p in user_props]
    doc_conds = [PropertyDocument.uploader_user_id == current_user.id]
    if prop_uuid_list:
        doc_conds.append(PropertyDocument.property_id.in_(prop_uuid_list))
    user_docs = list(
        db.scalars(
            select(PropertyDocument).where(or_(*doc_conds))
        ).all()
    )
    document_hashes = [d.document_hash for d in user_docs if d.document_hash]

    # 3. Transactions
    user_txs = list(
        db.scalars(
            select(PropertyTransaction).where(
                or_(
                    PropertyTransaction.seller_id == current_user.id,
                    PropertyTransaction.buyer_id == current_user.id,
                )
            )
        ).all()
    )
    tx_hashes = [t.blockchain_tx_hash for t in user_txs if t.blockchain_tx_hash]
    tx_numbers = [t.transaction_number for t in user_txs if t.transaction_number]

    # 4. Wallets
    user_wallets = list(
        db.scalars(
            select(UserWallet).where(UserWallet.user_id == current_user.id)
        ).all()
    )
    wallet_addresses = [w.wallet_address.lower() for w in user_wallets if w.wallet_address]
    if current_user.wallet_address:
        wallet_addresses.append(current_user.wallet_address.lower())

    return {
        "property_ids": list(set(property_ids + property_uuids + blockchain_property_ids)),
        "document_hashes": list(set(document_hashes)),
        "tx_hashes": list(set(tx_hashes + tx_numbers)),
        "wallet_addresses": list(set(wallet_addresses)),
    }
