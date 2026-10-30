"""
Pydantic v2 schemas for EVM Wallet Linking and Signature Verification in PropChain.
"""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WalletChallengeRequest(BaseModel):
    wallet_address: str = Field(..., description="EVM 0x-prefixed 42-character address")
    chain_id: int = Field(default=31337, description="Target EVM chain ID")

    @field_validator("wallet_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        addr = v.strip().lower()
        if not addr.startswith("0x") or len(addr) != 42:
            raise ValueError("Invalid EVM wallet address format")
        return addr


class WalletChallengeResponse(BaseModel):
    challenge_message: str
    nonce: str
    wallet_address: str
    expires_at: datetime


class WalletVerifyRequest(BaseModel):
    wallet_address: str = Field(..., description="EVM 0x-prefixed 42-character address")
    signature: str = Field(..., description="EIP-191 personal_sign cryptographic signature (0x...)")
    nonce: str = Field(..., description="One-time challenge nonce")

    @field_validator("wallet_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        addr = v.strip().lower()
        if not addr.startswith("0x") or len(addr) != 42:
            raise ValueError("Invalid EVM wallet address format")
        return addr


class WalletResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    wallet_address: str
    chain_id: int
    is_verified: bool
    is_primary: bool
    verified_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

