"""
Models package for PropChain.
Exports all database entities for discovery and migration generation.
"""
from app.models.base import Base, BaseModel, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.approval import LegalRegistrationConfirmation, TransactionApproval
from app.models.blockchain import BlockchainEvent, BlockchainOperation, OwnershipEvent
from app.models.document import DocumentProcessingRecord, DocumentVerificationRecord, PropertyDocument
from app.models.login_attempt import LoginAttempt
from app.models.property import Property
from app.models.refresh_token import RefreshToken
from app.models.transaction import PropertyTransaction, TransactionStatusHistory
from app.models.user import User
from app.models.user_activity import UserActivityLog
from app.models.wallet import UserWallet

__all__ = [
    "Base",
    "BaseModel",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "User",
    "RefreshToken",
    "LoginAttempt",
    "UserActivityLog",
    "Property",
    "PropertyDocument",
    "DocumentProcessingRecord",
    "DocumentVerificationRecord",
    "UserWallet",
    "BlockchainOperation",
    "BlockchainEvent",
    "OwnershipEvent",
    "PropertyTransaction",
    "TransactionStatusHistory",
    "TransactionApproval",
    "LegalRegistrationConfirmation",
]
