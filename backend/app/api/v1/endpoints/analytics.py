"""
Analytics and Dashboard Telemetry Endpoints for PropChain.
Calculates live aggregated metrics directly from PostgreSQL/SQLite database and blockchain,
with tailored telemetry for each role: BUYER, PROPERTY_OWNER, VERIFIER, LEGAL_AUTHORITY, ADMIN.
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

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
    raw_role = current_user.role
    user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)

    # 1. Baseline metrics scoped by role
    base_prop_filter = []
    if user_role == UserRole.PROPERTY_OWNER.value:
        base_prop_filter.append(
            or_(
                Property.current_owner_id == current_user.id,
                Property.creator_user_id == current_user.id,
                and_(
                    Property.verification_status == "VERIFIED",
                    Property.status == "ACTIVE",
                ),
            )
        )
    elif user_role == UserRole.BUYER.value:
        base_prop_filter.append(
            or_(
                and_(
                    Property.verification_status == "VERIFIED",
                    Property.status == "ACTIVE",
                ),
                Property.current_owner_id == current_user.id,
                Property.creator_user_id == current_user.id,
            )
        )

    prop_base = select(Property)
    if base_prop_filter:
        prop_base = prop_base.where(*base_prop_filter)

    total_props = db.scalar(select(func.count()).select_from(prop_base.subquery())) or 0
    verified_props = db.scalar(
        select(func.count()).select_from(
            prop_base.where(Property.verification_status == "VERIFIED").subquery()
        )
    ) or 0
    pending_props = db.scalar(
        select(func.count()).select_from(
            prop_base.where(Property.verification_status == "PENDING").subquery()
        )
    ) or 0

    val_sub = prop_base.subquery()
    valuation_sum = db.scalar(select(func.sum(val_sub.c.valuation)))
    total_valuation = float(valuation_sum) if valuation_sum else 0.0

    if user_role == UserRole.PROPERTY_OWNER.value:
        active_txns = db.scalar(
            select(func.count(PropertyTransaction.id)).where(
                PropertyTransaction.seller_id == current_user.id,
                PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"]),
            )
        ) or 0
        pending_approvals_count = 0
    elif user_role == UserRole.BUYER.value:
        active_txns = db.scalar(
            select(func.count(PropertyTransaction.id)).where(
                PropertyTransaction.buyer_id == current_user.id,
                PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"]),
            )
        ) or 0
        pending_approvals_count = 0
    else:
        active_txns = db.scalar(
            select(func.count(PropertyTransaction.id)).where(
                PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"])
            )
        ) or 0
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
    if user_role == UserRole.PROPERTY_OWNER.value:
        seller_pending_stmt = seller_pending_stmt.where(PropertyTransaction.seller_id == current_user.id)
    elif user_role != UserRole.ADMIN.value:
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

    # Recent transactions (scoped for privacy if buyer or property owner)
    recent_txs_stmt = (
        select(PropertyTransaction)
        .options(
            joinedload(PropertyTransaction.property),
            joinedload(PropertyTransaction.buyer),
            joinedload(PropertyTransaction.seller),
        )
        .order_by(PropertyTransaction.created_at.desc())
    )
    if user_role == UserRole.PROPERTY_OWNER.value:
        recent_txs_stmt = recent_txs_stmt.where(PropertyTransaction.seller_id == current_user.id)
    elif user_role == UserRole.BUYER.value:
        recent_txs_stmt = recent_txs_stmt.where(PropertyTransaction.buyer_id == current_user.id)

    recent_txs = list(db.scalars(recent_txs_stmt.limit(10)).unique().all())

    formatted_txs = [
        {
            "id": str(t.id),
            "transaction_number": t.transaction_number,
            "property_id": str(t.property_id),
            "property_title": t.property.title if t.property else "Property Parcel",
            "purchase_price": float(t.proposed_amount) if t.proposed_amount else 0.0,
            "status": t.status,
            "buyer_name": t.buyer.full_name if t.buyer else "Buyer",
            "seller_name": t.seller.full_name if t.seller else "Seller",
            "blockchain_tx_hash": t.blockchain_tx_hash,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in recent_txs
    ]

    vol_stmt = select(func.sum(PropertyTransaction.proposed_amount)).where(
        PropertyTransaction.status == "COMPLETED"
    )
    if user_role == UserRole.PROPERTY_OWNER.value:
        vol_stmt = vol_stmt.where(PropertyTransaction.seller_id == current_user.id)
    elif user_role == UserRole.BUYER.value:
        vol_stmt = vol_stmt.where(PropertyTransaction.buyer_id == current_user.id)
    total_volume_sum = db.scalar(vol_stmt)
    total_volume = float(total_volume_sum) if total_volume_sum else 0.0

    recent_events_stmt = (
        select(OwnershipEvent)
        .options(
            joinedload(OwnershipEvent.property),
            joinedload(OwnershipEvent.previous_owner),
            joinedload(OwnershipEvent.new_owner),
        )
        .order_by(OwnershipEvent.created_at.desc())
        .limit(20)
    )
    db_events = list(db.scalars(recent_events_stmt).unique().all())
    formatted_events = [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "property_id": str(e.property_id),
            "property_title": e.property.title if e.property else "Real Estate Parcel",
            "property_number": e.property.property_number if e.property else "PROP",
            "tx_hash": e.blockchain_tx_hash or "",
            "block_number": e.block_number or 1,
            "previous_owner_address": e.previous_owner_address,
            "new_owner_address": e.new_owner_address,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in db_events
    ]

    payload: Dict[str, Any] = {
        "user_role": user_role,
        "total_properties": total_props,
        "verified_properties": verified_props,
        "pending_verifications": pending_props,
        "total_valuation": total_valuation,
        "active_transactions": active_txns,
        "pending_approvals_count": pending_approvals_count,
        "pending_purchase_requests": pending_purchase_requests,
        "total_transaction_volume": total_volume,
        "recent_transactions": formatted_txs,
        "recent_events": formatted_events,
    }

    # Role-tailored metrics
    if user_role == UserRole.BUYER.value:
        buyer_txs = list(
            db.scalars(
                select(PropertyTransaction)
                .options(joinedload(PropertyTransaction.property))
                .where(PropertyTransaction.buyer_id == current_user.id)
                .order_by(PropertyTransaction.created_at.desc())
            ).unique().all()
        )

        owned_props = list(
            db.scalars(
                select(Property)
                .where(Property.current_owner_id == current_user.id)
                .order_by(Property.created_at.desc())
            ).all()
        )

        payload["buyer_metrics"] = {
            "my_offers_count": len([t for t in buyer_txs if t.status not in ["COMPLETED", "CANCELLED", "REJECTED"]]),
            "my_completed_transactions_count": len([t for t in buyer_txs if t.status == "COMPLETED"]),
            "my_properties_count": len(owned_props),
            "my_transactions": [
                {
                    "id": str(t.id),
                    "transaction_number": t.transaction_number,
                    "property_id": str(t.property_id),
                    "property_title": t.property.title if t.property else "Parcel",
                    "purchase_price": float(t.proposed_amount) if t.proposed_amount else 0.0,
                    "status": t.status,
                    "blockchain_tx_hash": t.blockchain_tx_hash,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in buyer_txs
            ],
            "my_properties": [
                {
                    "id": str(p.id),
                    "property_number": p.property_number,
                    "title": p.title,
                    "city": p.city,
                    "valuation": float(p.valuation) if p.valuation else 0.0,
                    "status": p.status,
                }
                for p in owned_props
            ],
        }

    elif user_role == UserRole.PROPERTY_OWNER.value:
        seller_props = list(
            db.scalars(
                select(Property)
                .where(
                    or_(
                        Property.current_owner_id == current_user.id,
                        and_(
                            Property.current_owner_id.is_(None),
                            Property.creator_user_id == current_user.id,
                        ),
                    )
                )
                .order_by(Property.created_at.desc())
            ).all()
        )

        seller_txs = list(
            db.scalars(
                select(PropertyTransaction)
                .options(joinedload(PropertyTransaction.property), joinedload(PropertyTransaction.buyer))
                .where(PropertyTransaction.seller_id == current_user.id)
                .order_by(PropertyTransaction.created_at.desc())
            ).unique().all()
        )

        portfolio_val = sum(float(p.valuation or 0) for p in seller_props)
        verified_props_count = len([p for p in seller_props if p.verification_status == "VERIFIED"])
        active_sales_count = len([t for t in seller_txs if t.status not in ["COMPLETED", "CANCELLED", "REJECTED"]])
        completed_sales_count = len([t for t in seller_txs if t.status == "COMPLETED"])
        received_offers_count = len([t for t in seller_txs if t.status in ["INITIATED", "PENDING_SELLER_ACCEPTANCE", "OFFER_MADE"]])

        seller_prop_ids = [p.id for p in seller_props]
        doc_cond = [PropertyDocument.uploader_user_id == current_user.id]
        if seller_prop_ids:
            doc_cond.append(PropertyDocument.property_id.in_(seller_prop_ids))

        seller_docs = list(
            db.scalars(
                select(PropertyDocument)
                .options(joinedload(PropertyDocument.verification_records))
                .where(or_(*doc_cond))
                .order_by(PropertyDocument.created_at.desc())
            ).unique().all()
        )

        formatted_docs = []
        for d in seller_docs:
            review_note = None
            if d.status in ["REJECTED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"]:
                if d.verification_records:
                    last_rec = sorted(d.verification_records, key=lambda x: x.created_at or datetime.min, reverse=True)[0]
                    review_note = last_rec.comments or "Correction requested by title reviewer."
                else:
                    review_note = "Correction requested by title reviewer."

            formatted_docs.append({
                "id": str(d.id),
                "property_id": str(d.property_id),
                "title": d.title,
                "file_name": d.original_filename,
                "original_filename": d.original_filename,
                "document_type": d.document_type,
                "status": d.status,
                "document_hash": d.document_hash,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "review_notes": review_note,
            })

        payload["seller_metrics"] = {
            "listed_properties_count": len(seller_props),
            "verified_properties_count": verified_props_count,
            "portfolio_valuation": portfolio_val,
            "portfolio_valuation_usd": portfolio_val,
            "received_offers_count": received_offers_count,
            "active_sales_count": active_sales_count,
            "completed_sales_count": completed_sales_count,
            "pending_purchase_requests": pending_purchase_requests,
            "my_properties": [
                {
                    "id": str(p.id),
                    "property_number": p.property_number,
                    "title": p.title,
                    "city": p.city,
                    "state": p.state,
                    "property_type": p.property_type,
                    "valuation": float(p.valuation) if p.valuation else 0.0,
                    "status": p.status,
                    "verification_status": p.verification_status,
                    "blockchain_property_id": p.blockchain_property_id,
                    "blockchain_tx_hash": p.blockchain_tx_hash,
                    "anchor_tx_hash": p.blockchain_tx_hash,
                    "blockchain_block_number": p.blockchain_block_number,
                    "verified_at": p.verified_at.isoformat() if p.verified_at else None,
                }
                for p in seller_props
            ],
            "received_offers": [
                {
                    "id": str(t.id),
                    "transaction_number": t.transaction_number,
                    "property_id": str(t.property_id),
                    "property_title": t.property.title if t.property else "Parcel",
                    "buyer_name": t.buyer.full_name if t.buyer else "Buyer",
                    "purchase_price": float(t.proposed_amount) if t.proposed_amount else 0.0,
                    "amount": float(t.proposed_amount) if t.proposed_amount else 0.0,
                    "status": t.status,
                    "blockchain_tx_hash": t.blockchain_tx_hash,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in seller_txs
            ],

            "my_documents": formatted_docs,

            "blockchain_events": formatted_events,

        }

    elif user_role == UserRole.VERIFIER.value:
        from app.models.document import DocumentVerificationRecord
        verified_subq = (
            select(PropertyDocument.property_id)
            .join(DocumentVerificationRecord, DocumentVerificationRecord.document_id == PropertyDocument.id)
            .where(DocumentVerificationRecord.verifier_user_id == current_user.id)
        )
        pending_verification_props = list(
            db.scalars(
                select(Property)
                .options(joinedload(Property.creator), joinedload(Property.current_owner))
                .where(
                    or_(
                        Property.verification_status.in_(["SUBMITTED", "CORRECTION_REQUESTED"]),
                        and_(
                            Property.verification_status == "VERIFIED",
                            Property.id.in_(verified_subq),
                        ),
                    )
                )
                .order_by(Property.submitted_at.desc(), Property.created_at.desc())
            ).all()
        )

        submitted_prop_ids = [p.id for p in pending_verification_props]
        submitted_docs = (
            list(
                db.scalars(
                    select(PropertyDocument)
                    .where(PropertyDocument.property_id.in_(submitted_prop_ids))
                    .order_by(PropertyDocument.created_at.desc())
                ).all()
            )
            if submitted_prop_ids
            else []
        )

        pending_docs_count = len([
            d for d in submitted_docs
            if (d.status or "").upper() in {"SUBMITTED_FOR_REVIEW", "PENDING_REVIEW", "UPLOADED"}
        ])

        prop_queue = []
        for p in pending_verification_props:
            p_docs = [d for d in submitted_docs if d.property_id == p.id]
            approved_count = len([d for d in p_docs if (d.status or "").upper() == "VERIFIED"])
            seller_name = p.creator.full_name if p.creator else (p.current_owner.full_name if p.current_owner else "Seller")
            prop_queue.append({
                "id": str(p.id),
                "property_number": p.property_number,
                "title": p.title,
                "city": p.city,
                "state": p.state,
                "seller_name": seller_name,
                "valuation": float(p.valuation) if p.valuation else 0.0,
                "verification_status": p.verification_status,
                "submitted_at": p.submitted_at.isoformat() if p.submitted_at else (p.created_at.isoformat() if p.created_at else None),
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "approved_docs_count": approved_count,
                "total_docs_count": 4,
            })

        docs_queue = [
            {
                "id": str(d.id),
                "property_id": str(d.property_id),
                "title": d.title or d.original_filename,
                "document_type": d.document_type,
                "file_name": d.original_filename,
                "status": d.status,
                "document_hash": d.document_hash,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in submitted_docs[:10]
        ]

        awaiting_props_count = len([
            p for p in pending_verification_props
            if (p.verification_status or "").upper() in {"SUBMITTED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}
        ])
        all_verified_count = db.scalar(
            select(func.count()).select_from(
                select(Property).where(Property.verification_status == "VERIFIED").subquery()
            )
        ) or 0

        payload["verifier_metrics"] = {
            "properties_to_verify_count": awaiting_props_count,
            "verified_properties_count": all_verified_count,
            "documents_to_verify_count": pending_docs_count,
            "pending_documents_count": pending_docs_count,
            "properties_to_verify": prop_queue,
            "properties_queue": prop_queue,
            "recent_documents": docs_queue,
            "documents_queue": docs_queue,
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
                .options(
                    joinedload(PropertyTransaction.property),
                    joinedload(PropertyTransaction.buyer),
                    joinedload(PropertyTransaction.seller),
                )
                .where(
                    PropertyTransaction.status.in_([
                        "READY_FOR_LEGAL_CONFIRMATION",
                        "DOCUMENTS_VERIFIED",
                        "PENDING_LEGAL_CONFIRMATION",
                        "LEGALLY_REGISTERED",
                    ])
                )
                .order_by(PropertyTransaction.created_at.desc())
            ).unique().all()
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
                    "purchase_price": float(t.proposed_amount) if t.proposed_amount else 0.0,
                    "status": t.status,
                    "blockchain_tx_hash": t.blockchain_tx_hash,
                    "blockchain_block_number": t.blockchain_block_number,
                    "blockchain_error": t.blockchain_error,
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
