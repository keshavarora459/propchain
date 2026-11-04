"""
Stakeholder Approvals & Purchase Offer Review API Endpoints for PropChain.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.approval import TransactionApproval
from app.models.property import Property
from app.models.transaction import PropertyTransaction
from app.models.user import User
from app.schemas.transaction import TransactionApprovalResponse
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/approvals", tags=["Approvals"])


class ApprovalActionRequest(BaseModel):
    reason: Optional[str] = None
    comments: Optional[str] = None


def _enrich_approval(a: TransactionApproval) -> TransactionApprovalResponse:
    resp = TransactionApprovalResponse.model_validate(a)
    txn = a.transaction
    if txn:
        resp.transaction_number = txn.transaction_number
        resp.property_id = txn.property_id
        resp.proposed_amount = txn.proposed_amount
        resp.currency = txn.currency
        resp.transaction_status = txn.status
        if txn.property:
            resp.property_number = txn.property.property_number
            resp.property_title = txn.property.title
        if txn.buyer:
            resp.buyer_id = txn.buyer.id
            resp.buyer_name = txn.buyer.full_name
            resp.buyer_email = txn.buyer.email
        if txn.seller:
            resp.seller_id = txn.seller.id
            resp.seller_name = txn.seller.full_name
            resp.seller_email = txn.seller.email
    return resp


@router.get(
    "/pending",
    response_model=List[TransactionApprovalResponse],
    summary="Get pending approvals requiring action from the current stakeholder role",
)
def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_role = UserRole(current_user.role) if isinstance(current_user.role, str) else current_user.role
    stmt = (
        select(TransactionApproval)
        .join(PropertyTransaction, TransactionApproval.transaction_id == PropertyTransaction.id)
        .options(
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.property),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.buyer),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.seller),
        )
        .where(TransactionApproval.status == "PENDING")
        .order_by(TransactionApproval.created_at.desc())
    )

    if user_role == UserRole.PROPERTY_OWNER:
        # Seller approvals where user is the designated approver or the registered property seller
        stmt = stmt.where(
            or_(
                TransactionApproval.approver_user_id == current_user.id,
                PropertyTransaction.seller_id == current_user.id,
            )
        )
    elif user_role == UserRole.BUYER:
        stmt = stmt.where(PropertyTransaction.buyer_id == current_user.id)
    elif user_role in {UserRole.REGISTRAR, UserRole.VERIFIER, "REGISTRAR", "VERIFIER"}:
        stmt = stmt.where(TransactionApproval.approval_type == "DOCUMENT_VERIFICATION")
    elif user_role == UserRole.LEGAL_AUTHORITY:
        stmt = stmt.where(TransactionApproval.approval_type == "LEGAL_REGISTRATION")
    elif user_role == UserRole.ADMIN:
        pass
    else:
        return []

    approvals = list(db.scalars(stmt).unique().all())
    return [_enrich_approval(a) for a in approvals]


@router.get(
    "",
    response_model=List[TransactionApprovalResponse],
    summary="List approval history filtered by stakeholder access",
)
def list_approvals(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(TransactionApproval)
        .join(PropertyTransaction, TransactionApproval.transaction_id == PropertyTransaction.id)
        .options(
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.property),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.buyer),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.seller),
        )
        .order_by(TransactionApproval.created_at.desc())
    )

    user_role = UserRole(current_user.role) if isinstance(current_user.role, str) else current_user.role

    # Filter approvals so sellers see their purchase requests & approvals
    if user_role == UserRole.PROPERTY_OWNER:
        stmt = stmt.where(
            or_(
                TransactionApproval.approver_user_id == current_user.id,
                PropertyTransaction.seller_id == current_user.id,
            )
        )
    elif user_role == UserRole.BUYER:
        stmt = stmt.where(PropertyTransaction.buyer_id == current_user.id)
    elif user_role in {UserRole.REGISTRAR, UserRole.VERIFIER, "REGISTRAR", "VERIFIER"}:
        stmt = stmt.where(TransactionApproval.approval_type == "DOCUMENT_VERIFICATION")
    elif user_role == UserRole.LEGAL_AUTHORITY:
        stmt = stmt.where(TransactionApproval.approval_type == "LEGAL_REGISTRATION")
    elif user_role == UserRole.ADMIN:
        pass

    if status:
        stmt = stmt.where(TransactionApproval.status == status.upper())

    approvals = list(db.scalars(stmt.offset(skip).limit(limit)).unique().all())
    return [_enrich_approval(a) for a in approvals]


@router.post(
    "/{approval_id}/approve",
    response_model=TransactionApprovalResponse,
    summary="Approve a pending approval or buyer purchase proposal",
)
def approve_request(
    approval_id: uuid.UUID,
    payload: Optional[ApprovalActionRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(TransactionApproval)
        .options(
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.property),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.buyer),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.seller),
        )
        .where(TransactionApproval.id == approval_id)
    )
    approval = db.scalars(stmt).unique().first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")

    service = TransactionService(db)
    if approval.approval_type == "SELLER_ACCEPTANCE":
        service.seller_accept(approval.transaction_id, current_user)
    elif approval.approval_type == "DOCUMENT_VERIFICATION":
        service.verify_documents(
            approval.transaction_id,
            comments=(payload.comments if payload else None),
            current_user=current_user,
        )
    else:
        approval.status = "APPROVED"
        approval.actioned_at = datetime.now(timezone.utc)
        approval.approver_user_id = current_user.id
        db.commit()

    db.refresh(approval)
    return _enrich_approval(approval)


@router.post(
    "/{approval_id}/reject",
    response_model=TransactionApprovalResponse,
    summary="Reject a pending approval or buyer purchase proposal",
)
def reject_request(
    approval_id: uuid.UUID,
    payload: ApprovalActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(TransactionApproval)
        .options(
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.property),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.buyer),
            joinedload(TransactionApproval.transaction).joinedload(PropertyTransaction.seller),
        )
        .where(TransactionApproval.id == approval_id)
    )
    approval = db.scalars(stmt).unique().first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found.")

    reason = payload.reason or "Rejected by seller/authority"
    service = TransactionService(db)
    if approval.approval_type == "SELLER_ACCEPTANCE":
        service.seller_reject(approval.transaction_id, reason=reason, current_user=current_user)
    else:
        approval.status = "REJECTED"
        approval.rejection_reason = reason
        approval.actioned_at = datetime.now(timezone.utc)
        approval.approver_user_id = current_user.id
        db.commit()

    db.refresh(approval)
    return _enrich_approval(approval)
