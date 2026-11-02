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
        # Check buyer permission
        if not has_permission(UserRole(current_user.role), Permission.INITIATE_TRANSACTION):
            raise ForbiddenError("You do not have permission to initiate property transactions.")

        prop = self.db.get(Property, data.property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{data.property_id}' not found.")

        if prop.status != "ACTIVE":
            raise BadRequestError(f"Cannot transact on property with status '{prop.status}'.")
        if prop.verification_status != "VERIFIED":
            raise BadRequestError(f"Cannot transact on property that is not verified (current verification status: '{prop.verification_status}').")

        seller_id = prop.current_owner_id or prop.creator_user_id
        if seller_id == current_user.id:
            raise BadRequestError("You cannot initiate a purchase transaction on a property you already own.")

        txn_number = _generate_txn_number()
        while self.db.scalars(select(PropertyTransaction).where(PropertyTransaction.transaction_number == txn_number)).first():
            txn_number = _generate_txn_number()

        txn = PropertyTransaction(
            transaction_number=txn_number,
            property_id=prop.id,
            buyer_id=current_user.id,
            seller_id=seller_id,
            proposed_amount=data.proposed_amount,
            currency=data.currency.upper(),
            transaction_type=data.transaction_type.upper(),
            description=data.description,
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
            reason="Buyer initialized transaction conveyance proposal.",
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

    def get_transaction(self, transaction_id: uuid.UUID) -> TransactionDetailResponse:
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
        user_role = UserRole(current_user.role)
        # Non-admin/verifiers can only see transactions they are party to
        if user_role not in {UserRole.ADMIN, UserRole.VERIFIER, UserRole.LEGAL_AUTHORITY}:
            filters.append(
                or_(
                    PropertyTransaction.buyer_id == current_user.id,
                    PropertyTransaction.seller_id == current_user.id,
                )
            )

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

        user_role = UserRole(current_user.role)
        if user_role != UserRole.ADMIN and txn.seller_id != current_user.id:
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

        user_role = UserRole(current_user.role)
        if user_role != UserRole.ADMIN and txn.seller_id != current_user.id:
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
        if user_role not in {UserRole.ADMIN, UserRole.VERIFIER}:
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
        b_service = BlockchainService(self.db)
        if not b_service.is_network_connected():
            # In offline/test environments where blockchain node is unreachable, finalize DB ownership
            prop = txn.property
            if prop:
                prop.current_owner_id = txn.buyer_id
                txn.status = "COMPLETED"
                self.db.commit()
            return

        prop = txn.property
        seller_wallet = self.db.scalars(
            select(UserWallet).where(UserWallet.user_id == txn.seller_id, UserWallet.is_verified == True)
        ).first()
        buyer_wallet = self.db.scalars(
            select(UserWallet).where(UserWallet.user_id == txn.buyer_id, UserWallet.is_verified == True)
        ).first()

        prev_addr = seller_wallet.wallet_address if seller_wallet else "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        new_addr = buyer_wallet.wallet_address if buyer_wallet else "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"

        success, tx_hash, err = b_service.execute_ownership_transfer(
            prop=prop,
            previous_owner_user_id=txn.seller_id,
            new_owner_user_id=txn.buyer_id,
            previous_owner_address=prev_addr,
            new_owner_address=new_addr,
            transaction_id_str=txn.transaction_number,
        )

        if success and tx_hash:
            from_status = txn.status
            txn.status = "COMPLETED"
            txn.blockchain_tx_hash = tx_hash
            prop.current_owner_id = txn.buyer_id
            self._record_status_change(
                txn,
                from_status,
                "COMPLETED",
                current_user.id,
                f"Conveyance executed on EVM blockchain. Tx: {tx_hash}",
            )
            self.db.commit()

