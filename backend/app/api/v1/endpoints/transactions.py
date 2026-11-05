"""
Real Estate Transaction & Conveyance API Endpoints for PropChain.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.permissions import Permission
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.permissions import require_permission
from app.models.user import User
from app.schemas.transaction import (
    LegalConfirmationRequest,
    TransactionCreate,
    TransactionDetailResponse,
    TransactionRejectRequest,
    TransactionResponse,
)
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post(
    "",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate a property purchase transaction proposal (Buyer)",
)
def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(require_permission(Permission.INITIATE_TRANSACTION)),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.initiate_transaction(payload, current_user)


@router.get(
    "",
    response_model=List[TransactionResponse],
    summary="List transactions (filtered by role access)",
)
def list_transactions(
    property_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.list_transactions(
        current_user=current_user,
        property_id=property_id,
        status_filter=status,
    )


@router.get(
    "/{transaction_id}",
    response_model=TransactionDetailResponse,
    summary="Retrieve complete transaction detail, approval states, and status history",
)
def get_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.get_transaction(transaction_id, current_user=current_user)


@router.post(
    "/{transaction_id}/accept",
    response_model=TransactionResponse,
    summary="Seller accepts the transaction proposal",
)
def seller_accept_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.seller_accept(transaction_id, current_user)


@router.post(
    "/{transaction_id}/reject",
    response_model=TransactionResponse,
    summary="Seller rejects the transaction proposal",
)
def seller_reject_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.seller_reject(transaction_id, payload.reason, current_user)


@router.post(
    "/{transaction_id}/verify-documents",
    response_model=TransactionResponse,
    summary="Registrar approves document verification for this transaction",
)
def verifier_approve_transaction(
    transaction_id: uuid.UUID,
    comments: Optional[str] = Query(None),
    current_user: User = Depends(require_permission(Permission.REVIEW_APPROVALS)),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.verifier_approve(transaction_id, comments, current_user)


@router.post(
    "/{transaction_id}/legal-confirm",
    response_model=TransactionResponse,
    summary="Legal Authority records statutory land registry confirmation",
)
def legal_confirm_transaction(
    transaction_id: uuid.UUID,
    payload: LegalConfirmationRequest,
    current_user: User = Depends(require_permission(Permission.CONFIRM_LEGAL_REGISTRATION)),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.legal_confirm(transaction_id, payload, current_user)


@router.post(
    "/{transaction_id}/retry-conveyance",
    response_model=TransactionResponse,
    summary="Retry on-chain conveyance transfer for a legally registered transaction (Legal Authority)",
)
def retry_conveyance_transaction(
    transaction_id: uuid.UUID,
    current_user: User = Depends(require_permission(Permission.CONFIRM_LEGAL_REGISTRATION)),
    db: Session = Depends(get_db),
):
    service = TransactionService(db)
    return service.retry_conveyance(transaction_id, current_user)

