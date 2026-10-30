"""
EVM & MetaMask Wallet Linking Endpoints for PropChain.
"""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.wallet import (
    WalletChallengeRequest,
    WalletChallengeResponse,
    WalletResponse,
    WalletVerifyRequest,
)
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.post(
    "/challenge",
    response_model=WalletChallengeResponse,
    summary="Generate a one-time cryptographic challenge for MetaMask signing",
)
def create_wallet_challenge(
    payload: WalletChallengeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WalletService(db)
    return service.generate_challenge(
        wallet_address=payload.wallet_address,
        chain_id=payload.chain_id,
        current_user=current_user,
    )


@router.post(
    "/verify",
    response_model=WalletResponse,
    summary="Verify MetaMask signature and link wallet to authenticated user",
)
def verify_wallet_signature(
    payload: WalletVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WalletService(db)
    return service.verify_signature(payload, current_user)


@router.get(
    "/me",
    response_model=List[WalletResponse],
    summary="Get verified EVM wallets associated with the current user",
)
def get_my_wallets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = WalletService(db)
    return service.get_user_wallets(current_user)

