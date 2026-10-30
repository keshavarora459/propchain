"""
Service for MetaMask and EVM Wallet Challenge Generation and Signature Verification.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.models.user import User
from app.models.wallet import UserWallet
from app.schemas.wallet import (
    WalletChallengeResponse,
    WalletResponse,
    WalletVerifyRequest,
)


def _build_challenge_text(email: str, wallet_address: str, nonce: str) -> str:
    return (
        f"PropChain Authentication Challenge\n"
        f"User: {email}\n"
        f"Wallet: {wallet_address.lower()}\n"
        f"Nonce: {nonce}\n"
        f"Valid for: 10 minutes"
    )


class WalletService:
    def __init__(self, db: Session):
        self.db = db

    def generate_challenge(
        self,
        wallet_address: str,
        chain_id: int,
        current_user: User,
    ) -> WalletChallengeResponse:
        addr = wallet_address.strip().lower()
        nonce = secrets.token_hex(16)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Check if already verified by someone else
        existing_other = self.db.scalars(
            select(UserWallet).where(
                UserWallet.wallet_address == addr,
                UserWallet.user_id != current_user.id,
                UserWallet.is_verified == True,  # noqa: E712
            )
        ).first()
        if existing_other:
            raise ConflictError("This wallet address is already associated with another user account.")

        # Find or create record for current user
        wallet = self.db.scalars(
            select(UserWallet).where(
                UserWallet.user_id == current_user.id,
                UserWallet.wallet_address == addr,
            )
        ).first()

        if not wallet:
            wallet = UserWallet(
                user_id=current_user.id,
                wallet_address=addr,
                chain_id=chain_id,
                is_verified=False,
                is_primary=True,
                verification_nonce=nonce,
            )
            self.db.add(wallet)
        else:
            wallet.verification_nonce = nonce
            wallet.chain_id = chain_id

        self.db.commit()

        message = _build_challenge_text(current_user.email, addr, nonce)
        return WalletChallengeResponse(
            challenge_message=message,
            nonce=nonce,
            wallet_address=addr,
            expires_at=expires_at,
        )

    def verify_signature(
        self,
        payload: WalletVerifyRequest,
        current_user: User,
    ) -> WalletResponse:
        addr = payload.wallet_address.strip().lower()

        wallet = self.db.scalars(
            select(UserWallet).where(
                UserWallet.user_id == current_user.id,
                UserWallet.wallet_address == addr,
            )
        ).first()

        if not wallet or wallet.verification_nonce != payload.nonce:
            raise BadRequestError("Invalid or expired wallet verification challenge nonce.")

        # Reconstruct expected message
        message = _build_challenge_text(current_user.email, addr, payload.nonce)
        encoded_message = encode_defunct(text=message)

        try:
            recovered_address = Account.recover_message(
                encoded_message,
                signature=payload.signature,
            )
        except Exception as e:
            raise BadRequestError(f"Cryptographic signature recovery failed: {str(e)}")

        if recovered_address.lower() != addr:
            raise ForbiddenError(
                f"Signature address mismatch: recovered {recovered_address.lower()}, expected {addr}"
            )

        wallet.is_verified = True
        wallet.verified_at = datetime.now(timezone.utc)
        wallet.verification_nonce = None
        self.db.commit()
        self.db.refresh(wallet)

        return WalletResponse.model_validate(wallet)

    def get_user_wallets(self, current_user: User) -> List[WalletResponse]:
        wallets = list(
            self.db.scalars(
                select(UserWallet)
                .where(UserWallet.user_id == current_user.id)
                .order_by(UserWallet.created_at.desc())
            ).all()
        )
        return [WalletResponse.model_validate(w) for w in wallets]

