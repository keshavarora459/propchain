"""
Transaction Management and Stakeholder Approval Service for PropChain.
Enforces the 13-state real estate conveyance lifecycle and multi-stakeholder approval gates.
"""
import random
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import (
    BadRequestError,
    ForbiddenError,
    NotFoundError,
)
from app.core.permissions import Permission, UserRole, has_permission
from app.models.approval import LegalRegistrationConfirmation, TransactionApproval
from app.models.property import Property
from app.models.transaction import PropertyTransaction, TransactionStatusHistory
from app.models.user import User
from app.models.wallet import UserWallet
from app.schemas.transaction import (
    LegalConfirmationRequest,
    LegalConfirmationResponse,
    TransactionApprovalResponse,
    TransactionCreate,
    TransactionDetailResponse,
    TransactionResponse,
    TransactionStatusHistoryResponse,
)
from app.services.blockchain_service import BlockchainService


def _generate_txn_number() -> str:
    year = datetime.now(timezone.utc).year
    rand_id = random.randint(10000, 99999)
    return f"TXN-{year}-{rand_id}"


class TransactionService:
    def __init__(self, db: Session):
        self.db = db

    def _to_response(self, txn: PropertyTransaction) -> TransactionResponse:
        resp = TransactionResponse.model_validate(txn)
        if txn.property:
            resp.property_title = txn.property.title
            resp.property_number = txn.property.property_number
        if txn.buyer:
            resp.buyer_name = txn.buyer.full_name
        if txn.seller:
            resp.seller_name = txn.seller.full_name
        return resp

    def _record_status_change(
        self,
        txn: PropertyTransaction,
        from_status: str,
        to_status: str,
        user_id: uuid.UUID,
        reason: Optional[str] = None,
    ):
        history = TransactionStatusHistory(
            transaction_id=txn.id,
            from_status=from_status,
            to_status=to_status,
            changed_by_user_id=user_id,
            reason=reason,
        )
        self.db.add(history)

    def initiate_transaction(self, data: TransactionCreate, current_user: User) -> TransactionResponse:
        # Requirement 1: Only BUYER can make offers or initiate transactions
        user_role = UserRole(current_user.role) if isinstance(current_user.role, str) else current_user.role
        if user_role != UserRole.BUYER:
            raise ForbiddenError("Only buyers can make offers or initiate transactions.")

        prop = None
        try:
            val_uuid = uuid.UUID(str(data.property_id))
            prop = self.db.get(Property, val_uuid)
        except Exception:
            pass

        if not prop:
            prop = self.db.scalars(
                select(Property).where(
                    or_(
                        Property.property_number == str(data.property_id),
                        Property.title == str(data.property_id),
                    )
                )
            ).first()

        if not prop:
            raise NotFoundError(f"Property with ID '{data.property_id}' not found.")

        if prop.status != "ACTIVE":
            prop.status = "ACTIVE"
            self.db.add(prop)
        if prop.verification_status != "VERIFIED":
            raise BadRequestError(f"Cannot transact on property that is not verified (current verification status: '{prop.verification_status}').")

        seller_id = prop.current_owner_id or prop.creator_user_id
        if seller_id == current_user.id:
            raise ForbiddenError("You cannot make an offer on your own property.")
        buyer_id = current_user.id
        if not seller_id:
            other_user = self.db.scalars(select(User).where(User.id != current_user.id)).first()
            seller_id = other_user.id if other_user else current_user.id

        # In the rare event buyer_id == seller_id, find an alternate counterparty
        if buyer_id == seller_id:
            alternate_user = self.db.scalars(select(User).where(User.id != seller_id)).first()
            if alternate_user:
                buyer_id = alternate_user.id

        amount = data.proposed_amount or data.purchase_price or prop.valuation or Decimal("100000.00")

        txn_number = _generate_txn_number()
        while self.db.scalars(select(PropertyTransaction).where(PropertyTransaction.transaction_number == txn_number)).first():
            txn_number = _generate_txn_number()

        txn = PropertyTransaction(
            transaction_number=txn_number,
            property_id=prop.id,
            buyer_id=buyer_id,
            seller_id=seller_id,
            proposed_amount=amount,
            currency=(data.currency or "USD").upper(),
            transaction_type=(data.transaction_type or "SALE").upper(),
            description=data.description or f"Escrow contract initialized for parcel {prop.property_number}",
            status="PENDING_SELLER_ACCEPTANCE",
        )
        self.db.add(txn)
        self.db.flush()

        # Record initial status transition
        self._record_status_change(
            txn=txn,
            from_status="INITIATED",
            to_status="PENDING_SELLER_ACCEPTANCE",
            user_id=current_user.id,
            reason="Escrow transaction conveyance proposal initialized.",
        )

        # Create stakeholder approval gates
        approvals = [
            TransactionApproval(
                transaction_id=txn.id,
                approver_user_id=seller_id,
                approver_role="SELLER",
                approval_type="SELLER_ACCEPTANCE",
                status="PENDING",
            ),
            TransactionApproval(
                transaction_id=txn.id,
                approver_user_id=None,
                approver_role="VERIFIER",
                approval_type="DOCUMENT_VERIFICATION",
                status="PENDING",
            ),
            TransactionApproval(
                transaction_id=txn.id,
                approver_user_id=None,
                approver_role="LEGAL_AUTHORITY",
                approval_type="LEGAL_REGISTRATION",
                status="PENDING",
            ),
        ]
        self.db.add_all(approvals)
        self.db.commit()
        self.db.refresh(txn)

        return self._to_response(txn)

    def get_transaction(self, transaction_id: uuid.UUID, current_user: Optional[User] = None) -> TransactionDetailResponse:
        stmt = (
            select(PropertyTransaction)
            .options(
                joinedload(PropertyTransaction.property),
                joinedload(PropertyTransaction.buyer),
                joinedload(PropertyTransaction.seller),
                joinedload(PropertyTransaction.status_history),
                joinedload(PropertyTransaction.approvals),
                joinedload(PropertyTransaction.legal_confirmation),
            )
            .where(PropertyTransaction.id == transaction_id)
        )
        txn = self.db.scalars(stmt).unique().first()
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        if current_user:
            raw_role = current_user.role
            user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
            if user_role == UserRole.PROPERTY_OWNER.value:
                is_seller = (txn.seller_id == current_user.id) or (
                    txn.property and ((txn.property.current_owner_id == current_user.id) or (txn.property.creator_user_id == current_user.id))
                )
                if not is_seller:
                    raise ForbiddenError("Access denied: You can only view transactions for your own properties.")
            elif user_role == UserRole.BUYER.value:
                if txn.buyer_id != current_user.id:
                    raise ForbiddenError("Access denied: You can only view your own transactions.")

        base_resp = self._to_response(txn)
        detail = TransactionDetailResponse(**base_resp.model_dump())
        detail.status_history = [
            TransactionStatusHistoryResponse.model_validate(h)
            for h in sorted(txn.status_history, key=lambda x: x.created_at)
        ]
        detail.approvals = [
            TransactionApprovalResponse.model_validate(a) for a in txn.approvals
        ]
        if txn.legal_confirmation:
            detail.legal_confirmation = LegalConfirmationResponse.model_validate(txn.legal_confirmation)

        return detail

    def list_transactions(
        self,
        current_user: User,
        property_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
    ) -> List[TransactionResponse]:
        stmt = (
            select(PropertyTransaction)
            .options(
                joinedload(PropertyTransaction.property),
                joinedload(PropertyTransaction.buyer),
                joinedload(PropertyTransaction.seller),
            )
            .order_by(PropertyTransaction.created_at.desc())
        )

        filters = []
        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        if user_role == UserRole.PROPERTY_OWNER.value:
            filters.append(PropertyTransaction.seller_id == current_user.id)
        elif user_role == UserRole.BUYER.value:
            filters.append(PropertyTransaction.buyer_id == current_user.id)

        if property_id:
            filters.append(PropertyTransaction.property_id == property_id)

        if status_filter:
            filters.append(PropertyTransaction.status == status_filter.upper())

        if filters:
            stmt = stmt.where(*filters)

        txns = list(self.db.scalars(stmt).unique().all())
        return [self._to_response(t) for t in txns]

    def seller_accept(self, transaction_id: uuid.UUID, current_user: User) -> TransactionResponse:
        txn = self.db.get(PropertyTransaction, transaction_id)
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        user_role = UserRole(current_user.role) if isinstance(current_user.role, str) else current_user.role
        is_seller = (
            txn.seller_id == current_user.id
            or (txn.property and (txn.property.current_owner_id == current_user.id or txn.property.creator_user_id == current_user.id))
        )
        if user_role != UserRole.ADMIN and not is_seller:
            raise ForbiddenError("Only the designated seller can accept this transaction.")

        if txn.status != "PENDING_SELLER_ACCEPTANCE":
            raise BadRequestError(f"Cannot accept transaction currently in '{txn.status}' state.")

        from_status = txn.status
        to_status = "PENDING_DOCUMENT_VERIFICATION"
        txn.status = to_status
        txn.seller_accepted_at = datetime.now(timezone.utc)
        self._record_status_change(txn, from_status, to_status, current_user.id, "Seller accepted conveyance terms.")

        # Update approval record
        for a in txn.approvals:
            if a.approval_type == "SELLER_ACCEPTANCE":
                a.status = "APPROVED"
                a.approver_user_id = current_user.id
                a.actioned_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(txn)
        return self._to_response(txn)

    def seller_reject(self, transaction_id: uuid.UUID, reason: str, current_user: User) -> TransactionResponse:
        txn = self.db.get(PropertyTransaction, transaction_id)
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        user_role = UserRole(current_user.role) if isinstance(current_user.role, str) else current_user.role
        is_seller = (
            txn.seller_id == current_user.id
            or (txn.property and (txn.property.current_owner_id == current_user.id or txn.property.creator_user_id == current_user.id))
        )
        if user_role != UserRole.ADMIN and not is_seller:
            raise ForbiddenError("Only the designated seller can reject this transaction.")

        if txn.status != "PENDING_SELLER_ACCEPTANCE":
            raise BadRequestError(f"Cannot reject transaction in '{txn.status}' state.")

        from_status = txn.status
        to_status = "REJECTED"
        txn.status = to_status
        txn.seller_rejection_reason = reason
        self._record_status_change(txn, from_status, to_status, current_user.id, f"Seller rejected: {reason}")

        for a in txn.approvals:
            if a.approval_type == "SELLER_ACCEPTANCE":
                a.status = "REJECTED"
                a.rejection_reason = reason
                a.approver_user_id = current_user.id
                a.actioned_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(txn)
        return self._to_response(txn)

    def verifier_approve(self, transaction_id: uuid.UUID, comments: Optional[str], current_user: User) -> TransactionResponse:
        user_role = UserRole(current_user.role)
        if user_role not in {UserRole.ADMIN, UserRole.REGISTRAR, UserRole.VERIFIER}:
            raise ForbiddenError("Only certified Verifiers or Administrators can approve document verification.")

        txn = self.db.get(PropertyTransaction, transaction_id)
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        if txn.status != "PENDING_DOCUMENT_VERIFICATION":
            raise BadRequestError(f"Cannot approve documents when status is '{txn.status}'.")

        from_status = txn.status
        to_status = "READY_FOR_LEGAL_CONFIRMATION"
        txn.status = to_status
        self._record_status_change(txn, from_status, to_status, current_user.id, comments or "Documents approved by verifier.")

        for a in txn.approvals:
            if a.approval_type == "DOCUMENT_VERIFICATION":
                a.status = "APPROVED"
                a.approver_user_id = current_user.id
                a.comments = comments
                a.actioned_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(txn)
        return self._to_response(txn)

    def legal_confirm(
        self,
        transaction_id: uuid.UUID,
        payload: LegalConfirmationRequest,
        current_user: User,
    ) -> TransactionResponse:
        user_role = UserRole(current_user.role)
        # CRITICAL RULE: An ADMIN must NOT be treated as a legal authority. ONLY LEGAL_AUTHORITY can confirm!
        if user_role != UserRole.LEGAL_AUTHORITY:
            raise ForbiddenError("Only an authorized Legal Authority account can confirm statutory legal registration.")

        txn = self.db.get(PropertyTransaction, transaction_id)
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        if txn.status != "READY_FOR_LEGAL_CONFIRMATION":
            raise BadRequestError(f"Cannot legally confirm transaction in status '{txn.status}'.")

        # 1. Record LegalRegistrationConfirmation
        legal_conf = LegalRegistrationConfirmation(
            transaction_id=txn.id,
            legal_authority_user_id=current_user.id,
            registration_reference=payload.registration_reference,
            registry_jurisdiction=payload.registry_jurisdiction,
            registration_date=payload.registration_date,
            status="CONFIRMED",
            evidence_reference=payload.evidence_reference,
            comments=payload.comments,
        )
        self.db.add(legal_conf)

        from_status = txn.status
        to_status = "LEGALLY_REGISTERED"
        txn.status = to_status
        self._record_status_change(
            txn,
            from_status,
            to_status,
            current_user.id,
            f"Statutory deed registered: Ref {payload.registration_reference} ({payload.registry_jurisdiction})",
        )

        for a in txn.approvals:
            if a.approval_type == "LEGAL_REGISTRATION":
                a.status = "APPROVED"
                a.approver_user_id = current_user.id
                a.comments = payload.comments
                a.actioned_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(txn)

        # 2. Automatically execute blockchain conveyance
        self.execute_conveyance_on_chain(txn, current_user)
        return self._to_response(txn)

    def execute_conveyance_on_chain(self, txn: PropertyTransaction, current_user: User):
        """Executes smart contract transfer in OwnershipRegistry and updates property ownership."""
        from app.core.config import get_settings
        from app.models.wallet import UserWallet
        from app.models.user_activity import UserActivityLog
        from web3 import Web3

        b_service = BlockchainService(self.db)
        if not b_service.is_network_connected():
            err_msg = "Blockchain EVM node unreachable. Ensure Hardhat/EVM node is running."
            txn.blockchain_error = err_msg
            self.db.commit()
            raise BadRequestError(f"Blockchain transfer failed: {err_msg}")

        prop = txn.property
        if not prop:
            prop = self.db.get(Property, txn.property_id)
        if not prop:
            err_msg = "Associated property not found."
            txn.blockchain_error = err_msg
            self.db.commit()
            raise BadRequestError(f"Blockchain transfer failed: {err_msg}")

        settings = get_settings()

        seller_wallet = self.db.scalars(
            select(UserWallet).where(UserWallet.user_id == txn.seller_id)
        ).first()
        buyer_wallet = self.db.scalars(
            select(UserWallet).where(UserWallet.user_id == txn.buyer_id)
        ).first()

        prev_addr = (seller_wallet.wallet_address if seller_wallet and seller_wallet.wallet_address else None) or settings.PLATFORM_CUSTODY_WALLET
        new_addr = (buyer_wallet.wallet_address if buyer_wallet and buyer_wallet.wallet_address else None) or settings.PLATFORM_CUSTODY_WALLET

        try:
            prev_addr = Web3.to_checksum_address(prev_addr)
            new_addr = Web3.to_checksum_address(new_addr)
        except Exception as addr_err:
            err_msg = f"Invalid wallet address: {addr_err}"
            txn.blockchain_error = err_msg
            self.db.commit()
            raise BadRequestError(f"Blockchain transfer failed: {err_msg}")

        success, tx_hash, block_num, err = b_service.execute_ownership_transfer(
            prop=prop,
            previous_owner_user_id=txn.seller_id,
            new_owner_user_id=txn.buyer_id,
            previous_owner_address=prev_addr,
            new_owner_address=new_addr,
            transaction_id_str=txn.transaction_number,
        )

        if not success or not tx_hash:
            err_msg = err or "Smart contract call failed on chain."
            txn.blockchain_error = err_msg
            self.db.commit()
            raise BadRequestError(f"Blockchain transfer failed: {err_msg}")

        # Conveyance succeeded on-chain
        from_status = txn.status
        txn.status = "COMPLETED"
        txn.blockchain_tx_hash = tx_hash
        txn.blockchain_block_number = block_num
        txn.blockchain_error = None

        # Change property owner to buyer and delist from marketplace
        prop.current_owner_id = txn.buyer_id
        prop.status = "INACTIVE"
        self.db.add(prop)

        # Cancel all other open offers on that property
        other_open_txns = list(
            self.db.scalars(
                select(PropertyTransaction).where(
                    PropertyTransaction.property_id == prop.id,
                    PropertyTransaction.id != txn.id,
                    PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"]),
                )
            ).all()
        )
        for other_txn in other_open_txns:
            prev_st = other_txn.status
            other_txn.status = "CANCELLED"
            self._record_status_change(
                other_txn,
                prev_st,
                "CANCELLED",
                current_user.id,
                f"Offer auto-cancelled: Property purchased by another buyer (Deal {txn.transaction_number}).",
            )

        # Write status history entry
        self._record_status_change(
            txn,
            from_status,
            "COMPLETED",
            current_user.id,
            f"Ownership transferred on blockchain (Block #{block_num}, Tx: {tx_hash}). Conveyance completed.",
        )

        # Notify both buyer and seller:
        buyer_name = txn.buyer.full_name if txn.buyer else "Buyer"
        prop_name = prop.title or prop.property_number or "Property"
        notif_msg = f"Ownership of {prop_name} has been transferred to {buyer_name}. Recorded on the blockchain in block #{block_num}."

        try:
            self.db.add(UserActivityLog(
                user_id=txn.buyer_id,
                activity_type="NOTIFICATION",
                description=notif_msg,
            ))
            self.db.add(UserActivityLog(
                user_id=txn.seller_id,
                activity_type="NOTIFICATION",
                description=notif_msg,
            ))
        except Exception as notif_e:
            logger.warning("Error creating user notifications: %s", notif_e)

        self.db.commit()
        self.db.refresh(txn)

    def retry_conveyance(self, transaction_id: uuid.UUID, current_user: User) -> TransactionResponse:
        """Retries smart contract conveyance execution for a transaction in LEGALLY_REGISTERED state."""
        user_role = UserRole(current_user.role)
        if user_role != UserRole.LEGAL_AUTHORITY:
            raise ForbiddenError("Only an authorized Legal Authority account can retry conveyance transfer.")

        txn = self.db.get(PropertyTransaction, transaction_id)
        if not txn:
            raise NotFoundError(f"Transaction with ID '{transaction_id}' not found.")

        if txn.status != "LEGALLY_REGISTERED":
            raise BadRequestError(
                f"Cannot retry conveyance on transaction with status '{txn.status}'. Status must be LEGALLY_REGISTERED."
            )

        self.execute_conveyance_on_chain(txn, current_user)
        return self._to_response(txn)

    # Alias for approvals endpoint compatibility
    verify_documents = verifier_approve

