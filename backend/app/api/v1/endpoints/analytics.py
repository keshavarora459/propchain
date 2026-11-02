"""
Analytics and Dashboard Telemetry Endpoints for PropChain.
Calculates live aggregated metrics directly from PostgreSQL/SQLite database and blockchain.
"""
from decimal import Decimal
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.approval import TransactionApproval
from app.models.blockchain import OwnershipEvent
from app.models.property import Property
from app.models.transaction import PropertyTransaction
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", summary="Retrieve live dashboard operational metrics")
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return live metrics computed from database entities."""
    user_role = UserRole(current_user.role) if isinstance(current_user.role, str) else current_user.role

    # 1. Total and verified properties
    total_props = db.scalar(select(func.count(Property.id))) or 0
    verified_props = db.scalar(
        select(func.count(Property.id)).where(Property.verification_status == "VERIFIED")
    ) or 0
    pending_props = db.scalar(
        select(func.count(Property.id)).where(Property.verification_status == "PENDING")
    ) or 0

    # 2. Total valuation
    valuation_sum = db.scalar(select(func.sum(Property.valuation)))
    total_valuation = float(valuation_sum) if valuation_sum else 0.0

    # 3. Transactions count
    active_txns = db.scalar(
        select(func.count(PropertyTransaction.id)).where(
            PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"])
        )
    ) or 0
    completed_txns = db.scalar(
        select(func.count(PropertyTransaction.id)).where(
            PropertyTransaction.status == "COMPLETED"
        )
    ) or 0

    # 4. Pending approvals count
    pending_approvals_count = db.scalar(
        select(func.count(TransactionApproval.id)).where(
            TransactionApproval.status == "PENDING"
        )
    ) or 0

    # 5. Pending purchase requests specifically for this seller
    seller_pending_stmt = (
        select(PropertyTransaction)
        .options(
            joinedload(PropertyTransaction.property),
            joinedload(PropertyTransaction.buyer),
            joinedload(PropertyTransaction.seller),
        )
        .where(PropertyTransaction.status == "PENDING_SELLER_ACCEPTANCE")
    )
    if user_role == UserRole.PROPERTY_OWNER:
        seller_pending_stmt = seller_pending_stmt.where(PropertyTransaction.seller_id == current_user.id)
    elif user_role != UserRole.ADMIN:
        seller_pending_stmt = seller_pending_stmt.where(
            or_(
                PropertyTransaction.seller_id == current_user.id,
                PropertyTransaction.buyer_id == current_user.id,
            )
        )

    seller_pending_txs = list(
        db.scalars(seller_pending_stmt.order_by(PropertyTransaction.created_at.desc())).unique().all()
    )

    pending_purchase_requests = [
        {
            "id": str(t.id),
            "transaction_number": t.transaction_number,
            "property_id": str(t.property_id),
            "property_number": t.property.property_number if t.property else None,
            "property_title": t.property.title if t.property else "Real Estate Parcel",
            "buyer_id": str(t.buyer_id),
            "buyer_name": t.buyer.full_name if t.buyer else "Buyer",
            "buyer_email": t.buyer.email if t.buyer else None,
            "seller_id": str(t.seller_id),
            "seller_name": t.seller.full_name if t.seller else "Seller",
            "purchase_price": float(t.proposed_amount) if t.proposed_amount else 0.0,
            "proposed_amount": float(t.proposed_amount) if t.proposed_amount else 0.0,
            "currency": t.currency,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in seller_pending_txs
    ]

    # 6. Recent transactions
    recent_txs = list(
        db.scalars(
            select(PropertyTransaction)
            .options(joinedload(PropertyTransaction.property))
            .order_by(PropertyTransaction.created_at.desc())
            .limit(5)
        ).unique().all()
    )

    formatted_txs = [
        {
            "id": str(t.id),
            "transaction_number": t.transaction_number,
            "property_id": str(t.property_id),
            "property_title": t.property.title if t.property else "Property Parcel",
            "purchase_price": float(t.proposed_amount) if t.proposed_amount else 0.0,
            "status": t.status,
            "blockchain_tx_hash": t.blockchain_tx_hash,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in recent_txs
    ]

    # 7. Recent ownership events
    recent_events = list(
        db.scalars(
            select(OwnershipEvent)
            .order_by(OwnershipEvent.created_at.desc())
            .limit(5)
        ).all()
    )

    formatted_events = [
        {
            "id": str(e.id),
            "property_id": str(e.property_id),
            "property_number": e.property.property_number if e.property else None,
            "event_type": e.event_type,
            "tx_hash": e.tx_hash,
            "block_number": e.block_number,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in recent_events
    ]

    return {
        "total_properties": total_props,
        "verified_properties": verified_props,
        "pending_properties": pending_props,
        "total_valuation_usd": total_valuation,
        "active_transactions": active_txns,
        "completed_transactions": completed_txns,
        "pending_approvals": len(pending_purchase_requests) if user_role == UserRole.PROPERTY_OWNER else pending_approvals_count,
        "pending_purchase_requests": pending_purchase_requests,
        "fraud_alerts": 0,
        "recent_transactions": formatted_txs,
        "recent_events": formatted_events,
    }
