"""
Stakeholder Approvals API Endpoints for PropChain.
"""
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.approval import TransactionApproval
from app.models.user import User
from app.schemas.transaction import TransactionApprovalResponse

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get(
    "/pending",
    response_model=List[TransactionApprovalResponse],
    summary="Get pending approvals requiring action from the current stakeholder role",
)
def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_role = UserRole(current_user.role)
    stmt = (
        select(TransactionApproval)
        .options(joinedload(TransactionApproval.transaction))
        .where(TransactionApproval.status == "PENDING")
        .order_by(TransactionApproval.created_at.desc())
    )

    if user_role == UserRole.PROPERTY_OWNER:
        # Seller approvals where user is the approver
        stmt = stmt.where(TransactionApproval.approver_user_id == current_user.id)
    elif user_role == UserRole.VERIFIER:
        stmt = stmt.where(TransactionApproval.approval_type == "DOCUMENT_VERIFICATION")
    elif user_role == UserRole.LEGAL_AUTHORITY:
        stmt = stmt.where(TransactionApproval.approval_type == "LEGAL_REGISTRATION")
    elif user_role == UserRole.ADMIN:
        # Admin can view all
        pass
    else:
        return []

    approvals = list(db.scalars(stmt).unique().all())
    return [TransactionApprovalResponse.model_validate(a) for a in approvals]


@router.get(
    "",
    response_model=List[TransactionApprovalResponse],
    summary="List approval history",
)
def list_approvals(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(TransactionApproval)
        .order_by(TransactionApproval.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    approvals = list(db.scalars(stmt).all())
    return [TransactionApprovalResponse.model_validate(a) for a in approvals]

