import logging
logger = logging.getLogger(__name__)
"""
Transaction Management and Stakeholder Approval Service for PropChain.
Enforces the 13-state real estate conveyance lifecycle and multi-stakeholder approval gates.
"""
import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal
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
from app.services.tokenization import (
    compute_property_token_stats,
    normalize_purchase_mode,
    resolve_txn_token_meta,
)


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
        meta = resolve_txn_token_meta(txn, txn.property)
        resp.purchase_mode = meta["purchase_mode"]
        resp.token_quantity = meta["token_quantity"]
        resp.token_symbol = meta["token_symbol"]
        resp.ownership_percentage = meta["ownership_percentage"]
        resp.property_is_tokenized = meta["property_is_tokenized"]
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

        if (prop.status or "").upper() == "INACTIVE":
            raise BadRequestError("Cannot transact on this property because it is already sold or inactive.")
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

        token_stats = compute_property_token_stats(self.db, prop)
        is_tokenized = bool(token_stats["is_tokenized"])

        # Resolve purchase mode (default TOKEN_PURCHASE if token_quantity supplied; else ENTIRE_PROPERTY)
        purchase_mode = normalize_purchase_mode(
            data.purchase_mode,
            data.transaction_type,
            data.token_quantity,
        )

        token_quantity_val: Optional[int] = None
        ownership_pct_val = Decimal("100.0000")
        txn_type_val = (data.transaction_type or "SALE").upper()

        if purchase_mode == "TOKEN_PURCHASE":
            if not is_tokenized:
                raise BadRequestError(
                    "Fractional token offers are only allowed on tokenized properties. Please submit an Entire Property offer."
                )
            avail = int(token_stats["available_tokens"] or 0)
            total_tkns = int(token_stats["total_tokens"] or 0)
            min_tkns = int(token_stats["min_tokens_per_buyer"] or 1)
            tok_symbol = token_stats["token_symbol"] or "PROP-TKN"
            tok_price = float(token_stats["token_price"] or 0)

            if avail <= 0 or token_stats["sold_as_whole"]:
                raise BadRequestError(
                    f"All {tok_symbol} tokens on this property have already been sold."
                )
            if data.token_quantity is None or int(data.token_quantity) < 1:
                raise BadRequestError("Token quantity must be at least 1 for a fractional token offer.")

            qty = int(data.token_quantity)
            if qty < min_tkns and qty < avail:
                raise BadRequestError(
                    f"Minimum token purchase is {min_tkns} {tok_symbol} tokens."
                )
            if qty > avail:
                raise BadRequestError(
                    f"Requested {qty:,} {tok_symbol} tokens exceeds available supply ({avail:,} remaining)."
                )

            token_quantity_val = qty
            ownership_pct_val = Decimal(str(round((qty / total_tkns) * 100.0, 4)))
            txn_type_val = "TOKEN_PURCHASE"
            raw_amt = data.proposed_amount or data.purchase_price
            if raw_amt is not None:
                amount = Decimal(str(raw_amt))
            else:
                amount = Decimal(str(round(qty * tok_price, 2)))
            default_desc = (
                f"Fractional token purchase of {qty:,} {tok_symbol} "
                f"({float(ownership_pct_val):.2f}% ownership stake) in {prop.property_number}"
            )
        else:
            if is_tokenized and (int(token_stats["tokens_sold"] or 0) > 0 or token_stats["sold_as_whole"]):
                raise BadRequestError(
                    f"Cannot submit an entire-property offer: {int(token_stats['tokens_sold']):,} fractional tokens "
                    f"({token_stats['token_symbol']}) have already been settled to buyers."
                )
            if is_tokenized and token_stats.get("total_tokens"):
                token_quantity_val = int(token_stats["total_tokens"])
            if txn_type_val == "TOKEN_PURCHASE":
                txn_type_val = "SALE"
            amount = Decimal(str(data.proposed_amount or data.purchase_price or prop.valuation or Decimal("100000.00")))
            default_desc = f"Full 100% property acquisition escrow initialized for parcel {prop.property_number}"

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
            transaction_type=txn_type_val,
            purchase_mode=purchase_mode,
            token_quantity=token_quantity_val,
            ownership_percentage=ownership_pct_val,
            description=data.description or default_desc,
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
            reason=(
                f"Fractional token escrow offer initialized ({token_quantity_val:,} {token_stats['token_symbol'] or 'tokens'})."
                if purchase_mode == "TOKEN_PURCHASE" and token_quantity_val
                else "Entire property escrow conveyance proposal initialized."
            ),
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

        # Notify seller about new offer
        try:
            from app.services.notification_service import notify
            buyer_name = current_user.full_name or "A buyer"
            prop_name = prop.title if prop else "your property"
            if purchase_mode == "TOKEN_PURCHASE" and token_quantity_val:
                offer_scope = (
                    f"for {token_quantity_val:,} {token_stats['token_symbol'] or 'tokens'} "
                    f"({float(ownership_pct_val):.2f}% share)"
                )
            else:
                offer_scope = "for full entire-property ownership (100%)"
            notify(
                user_id=seller_id,
                title="New offer received",
                message=f"{buyer_name} offered ${float(amount):,.2f} {offer_scope} on {prop_name}. Next: accept or reject it under Received Offers.",
                type="ACTION_REQUIRED",
                link="/transactions",
                db=self.db,
            )
        except Exception as notif_err:
            logger.warning("Notification on offer initiate notice: %s", notif_err)

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
        detail.approvals = []
        for a in txn.approvals:
            a_resp = TransactionApprovalResponse.model_validate(a)
            a_resp.transaction_number = base_resp.transaction_number
            a_resp.property_id = base_resp.property_id
            a_resp.property_number = base_resp.property_number
            a_resp.property_title = base_resp.property_title
            a_resp.buyer_id = base_resp.buyer_id
            a_resp.buyer_name = base_resp.buyer_name
            a_resp.seller_id = base_resp.seller_id
            a_resp.seller_name = base_resp.seller_name
            a_resp.proposed_amount = base_resp.proposed_amount
            a_resp.currency = base_resp.currency
            a_resp.transaction_status = base_resp.status
            a_resp.purchase_mode = base_resp.purchase_mode
            a_resp.token_quantity = base_resp.token_quantity
            a_resp.token_symbol = base_resp.token_symbol
            a_resp.ownership_percentage = base_resp.ownership_percentage
            a_resp.property_is_tokenized = base_resp.property_is_tokenized
            detail.approvals.append(a_resp)
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

        # Notify buyer about accepted offer
        try:
            from app.services.notification_service import notify
            prop_name = txn.property.title if txn.property else "the property"
            notify(
                user_id=txn.buyer_id,
                title="Offer Accepted",
                message=f"Your offer on {prop_name} was accepted. Next: the verifier will review the deal documents.",
                type="SUCCESS",
                link="/transactions",
                db=self.db,
            )
        except Exception as notif_err:
            logger.warning("Notification on offer accept notice: %s", notif_err)

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

        # Notify buyer about rejected offer
        try:
            from app.services.notification_service import notify
            prop_name = txn.property.title if txn.property else "the property"
            notify(
                user_id=txn.buyer_id,
                title="Offer Rejected",
                message=f"Your offer on {prop_name} was rejected. Reason: {reason}. Next: browse other properties in the marketplace.",
                type="WARNING",
                link="/properties",
                db=self.db,
            )
        except Exception as notif_err:
            logger.warning("Notification on offer reject notice: %s", notif_err)

        return self._to_response(txn)

    def verifier_approve(self, transaction_id: uuid.UUID, comments: Optional[str], current_user: User) -> TransactionResponse:
        raw_role = current_user.role
        user_role_str = (raw_role.value if hasattr(raw_role, "value") else str(raw_role)).upper().strip()
        if user_role_str not in {UserRole.ADMIN.value, UserRole.REGISTRAR.value, UserRole.VERIFIER.value, "ADMIN", "REGISTRAR", "VERIFIER"}:
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

        # Notify legal authorities that deal documents are approved
        try:
            from app.services.notification_service import notify
            legal_authorities = self.db.scalars(
                select(User).where(
                    or_(
                        User.role == UserRole.LEGAL_AUTHORITY,
                        User.role == "LEGAL_AUTHORITY",
                    )
                )
            ).all()
            for la in legal_authorities:
                notify(
                    user_id=la.id,
                    title="Deal Ready for Legal Registration",
                    message=f"Deal {txn.transaction_number} is ready for legal registration.",
                    type="ACTION_REQUIRED",
                    link="/approvals",
                    db=self.db,
                )
        except Exception as notif_err:
            logger.warning("Notification on deal docs approval notice: %s", notif_err)

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

        txn_meta = resolve_txn_token_meta(txn, prop)
        token_stats = compute_property_token_stats(self.db, prop)
        is_fractional = (
            txn_meta["purchase_mode"] == "TOKEN_PURCHASE"
            and bool(token_stats["is_tokenized"])
        )
        qty_to_settle = int(txn_meta["token_quantity"] or 0) if is_fractional else 0
        avail_before = int(token_stats["available_tokens"] or 0) if token_stats["is_tokenized"] else 0

        if is_fractional:
            if qty_to_settle <= 0 or token_stats["sold_as_whole"] or qty_to_settle > avail_before:
                err_msg = (
                    f"Insufficient remaining tokens for fractional settlement: requested {qty_to_settle:,}, "
                    f"available {avail_before:,}."
                )
                txn.blockchain_error = err_msg
                self.db.commit()
                raise BadRequestError(f"Blockchain transfer failed: {err_msg}")
        elif token_stats["is_tokenized"] and (int(token_stats["tokens_sold"] or 0) > 0 or token_stats["sold_as_whole"]):
            err_msg = (
                f"Entire-property settlement blocked: {int(token_stats['tokens_sold']):,} fractional tokens "
                f"are already settled on this property."
            )
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
            is_fractional=is_fractional,
            token_quantity=qty_to_settle if is_fractional else None,
            ownership_percentage=txn_meta["ownership_percentage"],
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

        other_open_txns = list(
            self.db.scalars(
                select(PropertyTransaction).where(
                    PropertyTransaction.property_id == prop.id,
                    PropertyTransaction.id != txn.id,
                    PropertyTransaction.status.notin_(["COMPLETED", "CANCELLED", "REJECTED"]),
                )
            ).all()
        )

        if is_fractional:
            remaining_after = max(0, avail_before - qty_to_settle)
            total_tkns = int(token_stats["total_tokens"] or qty_to_settle)
            if remaining_after == 0:
                prop.status = "INACTIVE"
                if avail_before == total_tkns:
                    prop.current_owner_id = txn.buyer_id
                self.db.add(prop)
                for other_txn in other_open_txns:
                    prev_st = other_txn.status
                    other_txn.status = "CANCELLED"
                    self._record_status_change(
                        other_txn,
                        prev_st,
                        "CANCELLED",
                        current_user.id,
                        f"Offer auto-cancelled: All property tokens acquired (Deal {txn.transaction_number}).",
                    )
            else:
                prop.status = "ACTIVE"
                self.db.add(prop)
                for other_txn in other_open_txns:
                    other_meta = resolve_txn_token_meta(other_txn, prop)
                    should_cancel = (
                        other_meta["purchase_mode"] == "ENTIRE_PROPERTY"
                        or int(other_meta["token_quantity"] or 0) > remaining_after
                    )
                    if should_cancel:
                        prev_st = other_txn.status
                        other_txn.status = "CANCELLED"
                        self._record_status_change(
                            other_txn,
                            prev_st,
                            "CANCELLED",
                            current_user.id,
                            f"Offer auto-cancelled: Only {remaining_after:,} tokens remain available after Deal {txn.transaction_number}.",
                        )

            self._record_status_change(
                txn,
                from_status,
                "COMPLETED",
                current_user.id,
                f"Fractional token transfer ({qty_to_settle:,} {txn_meta['token_symbol'] or 'tokens'} / {txn_meta['ownership_percentage']:.2f}%) recorded on blockchain (Block #{block_num}, Tx: {tx_hash}).",
            )
        else:
            # Whole property buyout: transfer property owner to buyer and delist from marketplace
            prop.current_owner_id = txn.buyer_id
            prop.status = "INACTIVE"
            self.db.add(prop)

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

        try:
            from app.services.notification_service import notify
            if is_fractional:
                tok_label = f"{qty_to_settle:,} {txn_meta['token_symbol'] or 'tokens'} ({txn_meta['ownership_percentage']:.2f}% share)"
                notify(
                    user_id=txn.buyer_id,
                    title="Token Allocation Settled",
                    message=f"{tok_label} of {prop_name} settled to {buyer_name} in block #{block_num}.",
                    type="SUCCESS",
                    link=f"/properties/{prop.id}",
                    db=self.db,
                )
                notify(
                    user_id=txn.seller_id,
                    title="Token Allocation Settled",
                    message=f"{tok_label} of {prop_name} sold to {buyer_name} in block #{block_num}.",
                    type="INFO",
                    link=f"/properties/{prop.id}",
                    db=self.db,
                )
            else:
                notify(
                    user_id=txn.buyer_id,
                    title="Ownership Transferred",
                    message=f"Ownership of {prop_name} was transferred to {buyer_name}. Recorded on the blockchain in block #{block_num}. The property is now in your My Properties.",
                    type="SUCCESS",
                    link=f"/properties/{prop.id}",
                    db=self.db,
                )
                notify(
                    user_id=txn.seller_id,
                    title="Ownership Transferred",
                    message=f"Ownership of {prop_name} was transferred to {buyer_name}. Recorded on the blockchain in block #{block_num}.",
                    type="INFO",
                    link=f"/properties/{prop.id}",
                    db=self.db,
                )
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

