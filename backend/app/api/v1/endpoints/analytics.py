"""
Analytics and Dashboard Telemetry Endpoints for PropChain.
Calculates live aggregated metrics directly from PostgreSQL/SQLite database and blockchain,
with tailored telemetry for each role: BUYER, PROPERTY_OWNER, VERIFIER, LEGAL_AUTHORITY, ADMIN.
"""
from decimal import Decimal
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.approval import LegalRegistrationConfirmation, TransactionApproval
from app.models.blockchain import OwnershipEvent
from app.models.document import PropertyDocument
from app.models.property import Property
from app.models.transaction import PropertyTransaction
from app.models.user import User
from app.models.user_activity import UserActivityLog

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", summary="Retrieve live dashboard operational metrics")
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return live metrics computed from database entities, tailored for the authenticated role."""
    user_role = current_user.role

    # 1. Platform-wide baseline metrics
    total_props = db.scalar(select(func.count(Property.id))) or 0
    verified_props = db.scalar(
        select(func.count(Property.id)).where(Property.verification_status == "VERIFIED")
    ) or 0
    pending_props = db.scalar(
        select(func.count(Property.id)).where(Property.verification_status == "PENDING")
    ) or 0

    valuation_sum = db.scalar(select(func.sum(Property.valuation)))
    total_valuation = float(valuation_sum) if valuation_sum else 0.0

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

    pending_approvals_count = db.scalar(
        select(func.count(TransactionApproval.id)).where(
            TransactionApproval.status == "PENDING"
        )
    ) or 0

    # Recent transactions
    recent_txs = list(
        db.scalars(
            select(PropertyTransaction)
            .order_by(PropertyTransaction.created_at.desc())
            .limit(10)
        ).all()
    )

    formatted_txs = [
        {
            "id": str(t.id),
            "transaction_number": t.transaction_number,
            "property_id": str(t.property_id),
            "property_title": t.property.title if t.property else "Property Parcel",
            "purchase_price": float(t.purchase_price) if t.purchase_price else 0.0,
            "status": t.status,
            "buyer_name": t.buyer.full_name if t.buyer else "Buyer",
            "seller_name": t.seller.full_name if t.seller else "Seller",
            "blockchain_tx_hash": t.blockchain_tx_hash,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in recent_txs
    ]

    # Recent ownership events
    recent_events = list(
        db.scalars(
            select(OwnershipEvent)
            .order_by(OwnershipEvent.created_at.desc())
            .limit(10)
        ).all()
    )

    formatted_events = [
        {
            "id": str(e.id),
            "property_id": str(e.property_id),
            "property_number": e.property.property_number if e.property else None,
            "property_title": e.property.title if e.property else "Land Parcel",
            "event_type": e.event_type,
            "tx_hash": e.tx_hash,
            "block_number": e.block_number,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in recent_events
    ]

    # Base payload structure
    payload: Dict[str, Any] = {
        "user_role": user_role,
        "user_id": str(current_user.id),
        "user_name": current_user.full_name,
        "total_properties": total_props,
        "verified_properties": verified_props,
        "pending_properties": pending_props,
        "total_valuation_usd": total_valuation,
        "active_transactions": active_txns,
        "completed_transactions": completed_txns,
        "pending_approvals": pending_approvals_count,
        "fraud_alerts": 0,
        "recent_transactions": formatted_txs,
        "recent_events": formatted_events,
    }

    # Role-specific computations
    if user_role == UserRole.BUYER.value:
        buyer_active_offers = db.scalar(
            select(func.count(PropertyTransaction.id)).where(
                PropertyTransaction.buyer_id == current_user.id,
                PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"]),
            )
        ) or 0

        buyer_completed = db.scalar(
            select(func.count(PropertyTransaction.id)).where(
                PropertyTransaction.buyer_id == current_user.id,
                PropertyTransaction.status == "COMPLETED",
            )
        ) or 0

        buyer_props = list(
            db.scalars(
                select(Property).where(Property.current_owner_id == current_user.id)
            ).all()
        )

        buyer_txs = list(
            db.scalars(
                select(PropertyTransaction)
                .where(PropertyTransaction.buyer_id == current_user.id)
                .order_by(PropertyTransaction.created_at.desc())
            ).all()
        )

        available_props_count = db.scalar(
            select(func.count(Property.id)).where(
                Property.status == "ACTIVE",
                Property.verification_status == "VERIFIED",
            )
        ) or 0

        payload["buyer_metrics"] = {
            "active_offers_count": buyer_active_offers,
            "completed_purchases_count": buyer_completed,
            "owned_properties_count": len(buyer_props),
            "available_verified_count": available_props_count,
            "my_properties": [
                {
                    "id": str(p.id),
                    "property_number": p.property_number,
                    "title": p.title,
                    "property_type": p.property_type,
                    "city": p.city,
                    "state": p.state,
                    "valuation": float(p.valuation) if p.valuation else 0.0,
                    "verification_status": p.verification_status,
                    "blockchain_property_id": p.property_number,
                }
                for p in buyer_props
            ],
            "my_transactions": [
                {
                    "id": str(t.id),
                    "transaction_number": t.transaction_number,
                    "property_title": t.property.title if t.property else "Property",
                    "seller_name": t.seller.full_name if t.seller else "Seller",
                    "amount": float(t.purchase_price) if t.purchase_price else 0.0,
                    "status": t.status,
                    "blockchain_tx_hash": t.blockchain_tx_hash,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in buyer_txs
            ],
        }

    elif user_role == UserRole.PROPERTY_OWNER.value:
        seller_props = list(
            db.scalars(
                select(Property).where(
                    or_(
                        Property.current_owner_id == current_user.id,
                        Property.creator_user_id == current_user.id,
                    )
                ).order_by(Property.created_at.desc())
            ).all()
        )
        seller_prop_ids = [p.id for p in seller_props]

        seller_verified = sum(1 for p in seller_props if p.verification_status == "VERIFIED")
        seller_pending = sum(1 for p in seller_props if p.verification_status == "PENDING")
        seller_val = sum(float(p.valuation or 0) for p in seller_props)

        seller_offers = list(
            db.scalars(
                select(PropertyTransaction)
                .where(PropertyTransaction.seller_id == current_user.id)
                .order_by(PropertyTransaction.created_at.desc())
            ).all()
        ) if seller_prop_ids else []

        pending_offers_count = sum(1 for t in seller_offers if t.status in ("INITIATED", "PENDING_SELLER_ACCEPTANCE", "OFFER_MADE"))
        active_sales_count = sum(1 for t in seller_offers if t.status not in ("COMPLETED", "CANCELLED", "REJECTED"))
        completed_sales_count = sum(1 for t in seller_offers if t.status == "COMPLETED")

        # Seller documents
        seller_docs = list(
            db.scalars(
                select(PropertyDocument).where(PropertyDocument.uploader_user_id == current_user.id).order_by(PropertyDocument.created_at.desc()).limit(10)
            ).all()
        )

        payload["seller_metrics"] = {
            "listed_properties_count": len(seller_props),
            "verified_properties_count": seller_verified,
            "pending_verification_count": seller_pending,
            "portfolio_valuation_usd": seller_val,
            "pending_offers_count": pending_offers_count,
            "active_sales_count": active_sales_count,
            "completed_sales_count": completed_sales_count,
            "my_properties": [
                {
                    "id": str(p.id),
                    "property_number": p.property_number,
                    "title": p.title,
                    "property_type": p.property_type,
                    "city": p.city,
                    "state": p.state,
                    "valuation": float(p.valuation) if p.valuation else 0.0,
                    "verification_status": p.verification_status,
                    "status": p.status,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in seller_props
            ],
            "received_offers": [
                {
                    "id": str(t.id),
                    "transaction_number": t.transaction_number,
                    "property_title": t.property.title if t.property else "Property",
                    "buyer_name": t.buyer.full_name if t.buyer else "Buyer",
                    "amount": float(t.purchase_price) if t.purchase_price else 0.0,
                    "status": t.status,
                    "blockchain_tx_hash": t.blockchain_tx_hash,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in seller_offers
            ],
            "my_documents": [
                {
                    "id": str(d.id),
                    "title": d.title,
                    "document_type": d.document_type,
                    "status": d.status,
                    "document_hash": d.document_hash,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in seller_docs
            ],
        }

    elif user_role == UserRole.VERIFIER.value:
        pending_props_list = list(
            db.scalars(
                select(Property)
                .where(Property.verification_status == "PENDING")
                .order_by(Property.created_at.desc())
                .limit(10)
            ).all()
        )

        pending_docs_count = db.scalar(
            select(func.count(PropertyDocument.id)).where(
                PropertyDocument.status.in_(["UPLOADED", "PROCESSING", "PENDING_REVIEW", "REQUIRES_CORRECTION"])
            )
        ) or 0

        pending_appr_count = db.scalar(
            select(func.count(TransactionApproval.id)).where(
                TransactionApproval.approval_type == "DOCUMENT_VERIFICATION",
                TransactionApproval.status == "PENDING",
            )
        ) or 0

        recent_docs = list(
            db.scalars(
                select(PropertyDocument)
                .order_by(PropertyDocument.created_at.desc())
                .limit(10)
            ).all()
        )

        payload["verifier_metrics"] = {
            "pending_properties_count": pending_props,
            "verified_properties_count": verified_props,
            "pending_documents_count": pending_docs_count,
            "pending_approval_tasks_count": pending_appr_count,
            "properties_to_verify": [
                {
                    "id": str(p.id),
                    "property_number": p.property_number,
                    "title": p.title,
                    "property_type": p.property_type,
                    "city": p.city,
                    "state": p.state,
                    "valuation": float(p.valuation) if p.valuation else 0.0,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in pending_props_list
            ],
            "recent_documents": [
                {
                    "id": str(d.id),
                    "property_id": str(d.property_id),
                    "property_title": d.property.title if d.property else "Parcel",
                    "title": d.title,
                    "document_type": d.document_type,
                    "status": d.status,
                    "document_hash": d.document_hash,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in recent_docs
            ],
        }

    elif user_role == UserRole.LEGAL_AUTHORITY.value:
        pending_legal_apprs = list(
            db.scalars(
                select(TransactionApproval)
                .where(
                    TransactionApproval.approval_type == "LEGAL_REGISTRATION",
                    TransactionApproval.status == "PENDING",
                )
                .order_by(TransactionApproval.created_at.desc())
            ).all()
        )

        ready_for_legal_txs = list(
            db.scalars(
                select(PropertyTransaction)
                .where(
                    PropertyTransaction.status.in_(["READY_FOR_LEGAL_CONFIRMATION", "DOCUMENTS_VERIFIED"])
                )
                .order_by(PropertyTransaction.created_at.desc())
            ).all()
        )

        completed_confirmations = list(
            db.scalars(
                select(LegalRegistrationConfirmation)
                .order_by(LegalRegistrationConfirmation.created_at.desc())
                .limit(10)
            ).all()
        )

        payload["legal_metrics"] = {
            "pending_confirmations_count": len(pending_legal_apprs),
            "ready_for_legal_count": len(ready_for_legal_txs),
            "completed_registrations_count": len(completed_confirmations),
            "pending_requests": [
                {
                    "id": str(t.id),
                    "transaction_number": t.transaction_number,
                    "property_id": str(t.property_id),
                    "property_title": t.property.title if t.property else "Parcel",
                    "property_number": t.property.property_number if t.property else "PROP",
                    "buyer_name": t.buyer.full_name if t.buyer else "Buyer",
                    "seller_name": t.seller.full_name if t.seller else "Seller",
                    "purchase_price": float(t.purchase_price) if t.purchase_price else 0.0,
                    "status": t.status,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in ready_for_legal_txs
            ],
            "confirmation_history": [
                {
                    "id": str(c.id),
                    "transaction_id": str(c.transaction_id),
                    "registration_reference": c.registration_reference,
                    "registry_jurisdiction": c.registry_jurisdiction,
                    "registration_date": c.registration_date.isoformat() if c.registration_date else None,
                    "status": c.status,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in completed_confirmations
            ],
        }

    elif user_role == UserRole.ADMIN.value:
        total_users = db.scalar(select(func.count(User.id))) or 0
        active_users = db.scalar(select(func.count(User.id)).where(User.account_status == "ACTIVE")) or 0
        pending_users = db.scalar(select(func.count(User.id)).where(User.account_status == "PENDING_VERIFICATION")) or 0

        recent_users_list = list(
            db.scalars(
                select(User).order_by(User.created_at.desc()).limit(8)
            ).all()
        )

        recent_logs = list(
            db.scalars(
                select(UserActivityLog).order_by(UserActivityLog.created_at.desc()).limit(10)
            ).all()
        )

        payload["admin_metrics"] = {
            "total_users_count": total_users,
            "active_users_count": active_users,
            "pending_users_count": pending_users,
            "recent_users": [
                {
                    "id": str(u.id),
                    "full_name": u.full_name,
                    "email": u.email,
                    "role": u.role,
                    "account_status": u.account_status,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in recent_users_list
            ],
            "audit_logs": [
                {
                    "id": str(log.id),
                    "activity_type": log.activity_type,
                    "description": log.description,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in recent_logs
            ],
        }

    return payload
