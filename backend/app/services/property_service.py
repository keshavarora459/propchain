"""
Business logic service for Property Management in PropChain.
"""
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.logging import get_logger
from app.core.permissions import UserRole, Permission, has_permission, assert_property_access
from app.models.document import PropertyDocument
from app.models.property import Property
from app.models.user import User
from app.repositories.document_repository import DocumentRepository
from app.repositories.property_repository import PropertyRepository
from app.schemas.property import (
    PropertyCreate,
    PropertyListResponse,
    PropertyResponse,
    PropertyStatusUpdate,
    PropertyUpdate,
)


def _generate_property_number() -> str:
    year = datetime.now(timezone.utc).year
    rand_id = random.randint(10000, 99999)
    return f"PROP-{year}-{rand_id}"


REQUIRED_PROPERTY_DOC_SPECS = [
    {
        "type": "TITLE_DEED",
        "label": "Title Deed",
        "aliases": {"TITLE_DEED", "SALE_DEED"},
    },
    {
        "type": "CADASTRAL_SURVEY",
        "label": "Cadastral Survey",
        "aliases": {"CADASTRAL_SURVEY", "SURVEY_PLAN", "SURVEY_DOCUMENT"},
    },
    {
        "type": "TAX_CLEARANCE",
        "label": "Tax Clearance",
        "aliases": {"TAX_CLEARANCE", "TAX_RECEIPT"},
    },
    {
        "type": "ENCUMBRANCE_CERTIFICATE",
        "label": "Encumbrance Certificate",
        "aliases": {"ENCUMBRANCE_CERTIFICATE"},
    },
]

logger = get_logger("property_service")


class PropertyService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PropertyRepository(db)
        self.doc_repo = DocumentRepository(db)

    def _to_response(self, prop: Property) -> PropertyResponse:
        owner_name = prop.current_owner.full_name if prop.current_owner else (
            prop.creator.full_name if prop.creator else None
        )
        owner_email = prop.current_owner.email if prop.current_owner else (
            prop.creator.email if prop.creator else None
        )

        seller_id = prop.creator_user_id or prop.current_owner_id
        seller_has_wallet = False
        if seller_id:
            try:
                from app.models.wallet import UserWallet
                wallet_rec = self.db.query(UserWallet).filter(UserWallet.user_id == seller_id).first()
                if wallet_rec and wallet_rec.wallet_address:
                    seller_has_wallet = True
            except Exception:
                pass

        if not seller_has_wallet and (prop.verification_status == "VERIFIED" or prop.status == "BLOCKCHAIN_REGISTERED"):
            owner_name = "Held by platform until the seller links a wallet"

        resp = PropertyResponse.model_validate(prop)
        resp.owner_name = owner_name
        resp.owner_email = owner_email

        # Attach document progress counts
        try:
            from app.models.document import PropertyDocument
            approved_count = self.db.query(PropertyDocument).filter(
                PropertyDocument.property_id == prop.id,
                PropertyDocument.status == "VERIFIED"
            ).count()
        except Exception:
            approved_count = 0
        resp.approved_documents_count = approved_count
        resp.required_documents_count = 4

        # Attach blockchain details
        try:
            from app.models.blockchain import BlockchainOperation, OwnershipEvent
            from app.services.blockchain_service import BlockchainService

            own_event = (
                self.db.query(OwnershipEvent)
                .filter(
                    OwnershipEvent.property_id == prop.id,
                    OwnershipEvent.event_type == "INITIAL_REGISTRATION",
                )
                .order_by(OwnershipEvent.created_at.desc())
                .first()
            )

            bc_op = (
                self.db.query(BlockchainOperation)
                .filter(
                    BlockchainOperation.entity_id == prop.id,
                    BlockchainOperation.operation_type == "REGISTER_PROPERTY",
                )
                .order_by(BlockchainOperation.created_at.desc())
                .first()
            )

            if prop.blockchain_tx_hash:
                resp.blockchain_tx_hash = prop.blockchain_tx_hash
            elif own_event and own_event.blockchain_tx_hash:
                resp.blockchain_tx_hash = own_event.blockchain_tx_hash
            elif bc_op and bc_op.tx_hash:
                resp.blockchain_tx_hash = bc_op.tx_hash

            resp.anchor_tx_hash = resp.blockchain_tx_hash

            if prop.blockchain_block_number is not None:
                resp.blockchain_block_number = prop.blockchain_block_number
            elif own_event and own_event.block_number:
                resp.blockchain_block_number = own_event.block_number
            elif bc_op and bc_op.block_number:
                resp.blockchain_block_number = bc_op.block_number

            if prop.blockchain_anchored_at:
                resp.blockchain_registration_timestamp = prop.blockchain_anchored_at
            elif own_event and own_event.confirmed_at:
                resp.blockchain_registration_timestamp = own_event.confirmed_at
            elif bc_op:
                resp.blockchain_registration_timestamp = bc_op.updated_at or bc_op.created_at

            if bc_op and bc_op.error_message and bc_op.status in ("FAILED", "REVERTED"):
                resp.blockchain_error = bc_op.error_message

            resp.blockchain_contract_address = BlockchainService.get_contract_address()
        except Exception as bc_meta_err:
            logger.warning("Could not populate blockchain metadata for property %s: %s", prop.id, bc_meta_err)

        # Verification metadata
        resp.verified_at = prop.verified_at
        resp.verified_by_id = prop.verified_by_id
        if prop.verified_by:
            resp.verified_by_name = prop.verified_by.full_name or prop.verified_by.email
        elif prop.verified_by_id:
            try:
                from app.models.user import User
                v_user = self.db.query(User).filter(User.id == prop.verified_by_id).first()
                if v_user:
                    resp.verified_by_name = v_user.full_name or v_user.email
            except Exception:
                pass

        # Seller name
        seller_user = prop.current_owner or prop.creator
        if seller_user:
            resp.seller_name = seller_user.full_name or seller_user.email
            resp.creator_name = resp.seller_name

        # Dev override flag state
        from app.core.config import get_settings
        _settings = get_settings()
        resp.allow_duplicate_override = bool(
            _settings.ALLOW_DUPLICATE_DOCS_ON_VERIFY and _settings.APP_ENV == "development"
        )

        return resp

    def register_property(self, data: PropertyCreate, current_user: User) -> PropertyResponse:
        # Check permission
        if not has_permission(UserRole(current_user.role), Permission.REGISTER_PROPERTY):
            raise ForbiddenError("You do not have permission to register properties.")

        # Duplicate detection check
        existing = self.repo.find_duplicate(
            state=data.state,
            city=data.city,
            postal_code=data.postal_code,
            street_address=data.street_address,
            survey_number=data.survey_number,
            ulpin=data.ulpin,
            registration_number=data.registration_number,
        )
        if existing:
            raise ConflictError(
                f"A property with matching cadastral or location records already exists ({existing.property_number})."
            )

        property_number = _generate_property_number()
        # Ensure property number uniqueness
        while self.repo.get_by_property_number(property_number):
            property_number = _generate_property_number()

        prop = Property(
            property_number=property_number,
            title=data.title,
            description=data.description,
            property_type=data.property_type.upper(),
            property_category=data.property_category.upper(),
            country=data.country,
            state=data.state,
            city=data.city,
            district=data.district,
            locality=data.locality,
            street_address=data.street_address,
            postal_code=data.postal_code,
            latitude=data.latitude,
            longitude=data.longitude,
            land_area=data.land_area,
            built_up_area=data.built_up_area,
            area_unit=data.area_unit.upper(),
            bedrooms=data.bedrooms,
            bathrooms=data.bathrooms,
            floors=data.floors,
            construction_year=data.construction_year,
            valuation=data.valuation,
            survey_number=data.survey_number,
            ulpin=data.ulpin,
            registration_number=data.registration_number,
            registry_jurisdiction=data.registry_jurisdiction,
            registration_date=data.registration_date,
            creator_user_id=current_user.id,
            current_owner_id=current_user.id,
            status="PENDING_DOCUMENTS",
            verification_status="PENDING",
        )

        created = self.repo.create(prop)
        return self._to_response(created)

    def get_property(self, property_id: uuid.UUID, current_user: Optional[User] = None) -> PropertyResponse:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")
        if current_user is not None:
            assert_property_access(current_user, prop, allow_marketplace=True)
        return self._to_response(prop)

    def delete_property(self, property_id: uuid.UUID, current_user: User) -> bool:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        is_admin = user_role == UserRole.ADMIN.value
        is_owner = (
            (prop.current_owner_id and str(prop.current_owner_id).lower() == str(current_user.id).lower()) or
            (prop.creator_user_id and str(prop.creator_user_id).lower() == str(current_user.id).lower())
        )

        if not is_admin and not is_owner:
            raise ForbiddenError("Only administrators or the property owner can delete this property.")

        return self.repo.delete(property_id)

    def list_properties(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        property_type: Optional[str] = None,
        status: Optional[str] = None,
        verification_status: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        mine: Optional[bool] = False,
        current_user: Optional[User] = None,
        verified_by_me: Optional[bool] = False,
    ) -> PropertyListResponse:
        skip = (page - 1) * page_size
        owner_id = current_user.id if (mine and current_user) else None
        items, total = self.repo.list_properties(
            skip=skip,
            limit=page_size,
            search=search,
            property_type=property_type,
            status=status,
            verification_status=verification_status,
            state=state,
            city=city,
            owner_id=owner_id,
            current_user=current_user,
            verified_by_me=verified_by_me,
        )

        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        return PropertyListResponse(
            items=[self._to_response(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def list_my_properties(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 10,
        status: Optional[str] = None,
    ) -> PropertyListResponse:
        skip = (page - 1) * page_size
        items, total = self.repo.list_properties(
            skip=skip,
            limit=page_size,
            status=status,
            owner_id=current_user.id,
            current_user=current_user,
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        return PropertyListResponse(
            items=[self._to_response(p) for p in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def update_property(
        self,
        property_id: uuid.UUID,
        data: PropertyUpdate,
        current_user: User,
    ) -> PropertyResponse:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        # IDOR protection: only Admin or the property's owner/creator can update
        user_role = UserRole(current_user.role)
        is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
        if user_role != UserRole.ADMIN and not is_owner:
            raise ForbiddenError("You are not authorized to update this property record.")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(prop, key):
                setattr(prop, key, value)

        updated = self.repo.update(prop)
        return self._to_response(updated)

    def validate_required_documents(self, property_id: uuid.UUID) -> None:
        """
        Verify that all 4 mandatory document types (TITLE_DEED, CADASTRAL_SURVEY,
        TAX_CLEARANCE, ENCUMBRANCE_CERTIFICATE) have been uploaded for the property.
        Raises BadRequestError listing missing document types if incomplete.
        """
        docs = self.doc_repo.list_by_property(property_id)
        valid_docs = [
            d for d in docs
            if (d.status or "").upper() not in {"REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}
        ]
        uploaded_types = {d.document_type.upper() for d in valid_docs}

        missing = []
        for spec in REQUIRED_PROPERTY_DOC_SPECS:
            if not (uploaded_types & spec["aliases"]):
                missing.append(f"{spec['type']} ({spec['label']})")

        if missing:
            raise BadRequestError(
                f"Cannot submit property for verification review. Missing required documents: {', '.join(missing)}"
            )

    def get_required_documents_status(
        self, property_id: uuid.UUID, current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")
        if current_user is not None:
            assert_property_access(current_user, prop, allow_marketplace=True)

        docs = self.doc_repo.list_by_property(property_id)
        valid_docs = [
            d for d in docs
            if (d.status or "").upper() not in {"REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}
        ]

        checklist = []
        missing = []
        for spec in REQUIRED_PROPERTY_DOC_SPECS:
            matching_docs = [
                d for d in valid_docs if d.document_type.upper() in spec["aliases"]
            ]
            is_uploaded = len(matching_docs) > 0
            doc_info = None
            if is_uploaded:
                latest = matching_docs[0]
                doc_info = {
                    "id": str(latest.id),
                    "title": latest.title,
                    "status": latest.status,
                    "document_hash": latest.document_hash,
                    "created_at": latest.created_at.isoformat() if latest.created_at else None,
                }
            else:
                missing.append(f"{spec['type']} ({spec['label']})")

            checklist.append({
                "type": spec["type"],
                "label": spec["label"],
                "is_uploaded": is_uploaded,
                "document": doc_info,
            })

        return {
            "property_id": str(property_id),
            "property_number": prop.property_number,
            "verification_status": prop.verification_status,
            "required_count": len(REQUIRED_PROPERTY_DOC_SPECS),
            "uploaded_count": len(REQUIRED_PROPERTY_DOC_SPECS) - len(missing),
            "all_uploaded": len(missing) == 0,
            "checklist": checklist,
            "missing": missing,
        }

    def submit_for_verification(
        self, property_id: uuid.UUID, current_user: User
    ) -> PropertyResponse:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        is_owner = (
            (prop.current_owner_id is not None and str(prop.current_owner_id) == str(current_user.id))
            or (prop.creator_user_id is not None and str(prop.creator_user_id) == str(current_user.id))
        )
        if user_role != UserRole.ADMIN.value and not is_owner:
            raise ForbiddenError("You are not authorized to submit this property for verification.")

        self.validate_required_documents(property_id)

        prop.verification_status = "SUBMITTED"
        prop.status = "UNDER_REVIEW"
        prop.submitted_at = datetime.now(timezone.utc)
        updated = self.repo.update(prop)

        # Set all active documents to SUBMITTED_FOR_REVIEW
        docs = self.doc_repo.list_by_property(property_id)
        for d in docs:
            d_status = (d.status or "").upper()
            if d_status not in {"REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}:
                d.status = "SUBMITTED_FOR_REVIEW"
                self.doc_repo.update(d)

        # Send notification to all VERIFIER users
        try:
            from app.models.user_activity import UserActivityLog
            verifiers = self.db.query(User).filter(User.role.in_([UserRole.REGISTRAR.value, UserRole.VERIFIER.value, "REGISTRAR", "VERIFIER"])).all()
            for v in verifiers:
                notif = UserActivityLog(
                    user_id=v.id,
                    activity_type="NOTIFICATION",
                    description=f"New property submitted for verification: {prop.title} ({prop.property_number})",
                )
                self.db.add(notif)
            self.db.commit()
        except Exception as notif_err:
            logger.warning("Notification creation notice: %s", notif_err)

        return self._to_response(updated)

    def verify_property(
        self, property_id: uuid.UUID, current_user: User
    ) -> PropertyResponse:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        if user_role not in {UserRole.REGISTRAR.value, UserRole.VERIFIER.value, "REGISTRAR", "VERIFIER"}:
            raise ForbiddenError("Only role REGISTRAR can verify a property.")

        if prop.verification_status == "PENDING":
            raise BadRequestError("Cannot verify a draft property that has not been submitted for verification.")

        docs = self.doc_repo.list_by_property(property_id)
        valid_docs = [
            d for d in docs
            if (d.status or "").upper() not in {"REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}
        ]

        # Verify all 4 required types are present
        uploaded_types = {d.document_type.upper() for d in valid_docs}
        missing = []
        for spec in REQUIRED_PROPERTY_DOC_SPECS:
            if not (uploaded_types & spec["aliases"]):
                missing.append(f"{spec['type']} ({spec['label']})")
        if missing:
            raise BadRequestError(f"Cannot verify property. Missing required documents: {', '.join(missing)}")

        # Item 3: Check for any unresolved cross-property duplicate document
        for d in valid_docs:
            d_hash = (d.document_hash or "").lower()
            other_doc = self.db.scalars(
                select(PropertyDocument).where(
                    PropertyDocument.document_hash == d_hash,
                    PropertyDocument.property_id != property_id,
                    PropertyDocument.status.not_in(["REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"])
                )
            ).first()
            if other_doc:
                other_p = self.repo.get_by_id(other_doc.property_id)
                p_name = other_p.title if other_p else "another property"
                # DEV ONLY: remove or set false before production.
                from app.core.config import get_settings
                settings = get_settings()
                if settings.ALLOW_DUPLICATE_DOCS_ON_VERIFY and settings.APP_ENV == "development":
                    logger.warning(
                        "DEV OVERRIDE: Allowing verification with duplicate document '%s' (duplicates property '%s', ID: %s).",
                        d.title or d.document_type,
                        p_name,
                        other_doc.property_id,
                    )
                else:
                    raise BadRequestError(
                        f"Cannot verify property while unresolved cross-property duplicate document exists: "
                        f"'{d.title or d.document_type}' is a duplicate of {p_name}. You must request correction or reject it."
                    )

        # Verify all 4 documents are VERIFIED
        unverified_docs = [
            d for d in valid_docs
            if (d.status or "").upper() != "VERIFIED"
        ]
        if unverified_docs:
            unverified_types = ", ".join([d.document_type for d in unverified_docs])
            raise BadRequestError(
                f"All 4 documents must be approved before verifying the property. Unverified documents: {unverified_types}"
            )

        # Resolve seller wallet: use linked wallet or PLATFORM_CUSTODY_WALLET setting from config
        from app.core.config import get_settings
        from app.models.wallet import UserWallet
        from app.services.blockchain_service import BlockchainService

        settings = get_settings()
        seller_wallet = None
        seller_id = prop.creator_user_id or prop.current_owner_id
        if seller_id:
            wallet_rec = self.db.query(UserWallet).filter(UserWallet.user_id == seller_id).first()
            if wallet_rec and wallet_rec.wallet_address:
                seller_wallet = wallet_rec.wallet_address

        if not seller_wallet:
            seller_wallet = settings.PLATFORM_CUSTODY_WALLET

        # Resolve primary document hash (reject fake hashes)
        primary_hash = None
        title_deed = next((d for d in valid_docs if d.document_type.upper() in {"TITLE_DEED", "SALE_DEED", "DEED"}), None)
        if title_deed and title_deed.document_hash:
            primary_hash = title_deed.document_hash
        else:
            for d in valid_docs:
                if d.document_hash:
                    primary_hash = d.document_hash
                    break

        if not primary_hash or primary_hash == "0x" + "00" * 32:
            raise BadRequestError("Cannot verify property: No verified document hash found for on-chain anchoring.")

        # Blockchain anchoring: do not set verification_status = VERIFIED until anchoring succeeds.
        bc_service = BlockchainService(self.db)
        try:
            bc_success, bc_tx, bc_error = bc_service.anchor_property(prop, seller_wallet, primary_hash)
        except Exception as bc_err:
            logger.warning("Blockchain anchor execution error: %s", bc_err)
            bc_success = False
            bc_error = str(bc_err)

        if not bc_success:
            # Keep property SUBMITTED and do NOT change anything else
            prop.verification_status = "SUBMITTED"
            self.repo.update(prop)
            logger.error("Blockchain anchoring failed for property %s: %s", prop.property_number, bc_error)
            raise BadRequestError("Blockchain not reachable. Start the node and try again.")

        # Anchoring succeeded: update status to VERIFIED and ACTIVE (NOT BLOCKCHAIN_REGISTERED)
        now_utc = datetime.now(timezone.utc)
        prop.verification_status = "VERIFIED"
        prop.status = "ACTIVE"
        prop.blockchain_property_id = prop.property_number
        if bc_tx:
            prop.blockchain_tx_hash = bc_tx
        prop.verified_at = now_utc
        prop.verified_by_id = current_user.id
        if not prop.blockchain_anchored_at:
            prop.blockchain_anchored_at = now_utc
        updated = self.repo.update(prop)

        # Notify seller and log verifier audit entry
        try:
            from app.models.user_activity import UserActivityLog
            seller_id = prop.creator_user_id or prop.current_owner_id
            if seller_id:
                desc = f"Your property {prop.title} is verified and recorded on the blockchain. Buyers can now see it."
                notif = UserActivityLog(
                    user_id=seller_id,
                    activity_type="NOTIFICATION",
                    description=desc,
                )
                self.db.add(notif)

            # Verifier audit record
            verifier_display = current_user.full_name or current_user.email
            audit_entry = UserActivityLog(
                user_id=current_user.id,
                activity_type="PROPERTY_VERIFIED_AUDIT",
                description=f"Verifier {verifier_display} ({current_user.id}) verified property {prop.property_number} ({prop.title}) on-chain (Tx: {prop.blockchain_tx_hash or bc_tx}, Block: #{prop.blockchain_block_number}).",
            )
            self.db.add(audit_entry)
            self.db.commit()
        except Exception as notif_err:
            logger.warning("Notification/audit log notice: %s", notif_err)

        return self._to_response(updated)

    def reject_property(
        self, property_id: uuid.UUID, reason: Optional[str], current_user: User
    ) -> PropertyResponse:
        """
        Rejects property verification with reason, verifier identity, and notification.
        Rejected properties are never anchored on-chain.
        """
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        if user_role not in {UserRole.REGISTRAR.value, UserRole.VERIFIER.value, "REGISTRAR", "VERIFIER"}:
            raise ForbiddenError("Only role REGISTRAR can reject a property.")

        prop.verification_status = "REJECTED"
        prop.status = "REJECTED"
        updated = self.repo.update(prop)

        # Notify seller
        try:
            from app.models.user_activity import UserActivityLog
            seller_id = prop.creator_user_id or prop.current_owner_id
            if seller_id:
                notif_msg = f"Your property '{prop.title}' ({prop.property_number}) verification was rejected."
                if reason:
                    notif_msg += f" Reason: {reason}"
                notif = UserActivityLog(
                    user_id=seller_id,
                    activity_type="NOTIFICATION",
                    description=notif_msg,
                )
                self.db.add(notif)
                self.db.commit()
        except Exception as notif_err:
            logger.warning("Notification log notice: %s", notif_err)

        return self._to_response(updated)

    def retry_blockchain_registration(
        self, property_id: uuid.UUID, current_user: User
    ) -> PropertyResponse:
        """
        Retries anchoring a verified property on the blockchain.
        Ensures idempotent re-execution and updates operational status.
        """
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
        is_owner = (
            (prop.current_owner_id is not None and str(prop.current_owner_id) == str(current_user.id))
            or (prop.creator_user_id is not None and str(prop.creator_user_id) == str(current_user.id))
        )
        if user_role not in {UserRole.ADMIN.value, UserRole.REGISTRAR.value, UserRole.VERIFIER.value, UserRole.LEGAL_AUTHORITY.value} and not is_owner:
            raise ForbiddenError("You are not authorized to retry blockchain registration for this property.")

        if (prop.verification_status or "").upper() != "VERIFIED":
            raise BadRequestError("Cannot anchor on blockchain: Property has not been verified by a title verifier.")

        if prop.status == "ACTIVE" and prop.verification_status == "VERIFIED" and (prop.blockchain_property_id or prop.blockchain_tx_hash):
            return self._to_response(prop)

        prop.status = "BLOCKCHAIN_PENDING"
        self.repo.update(prop)

        from app.services.blockchain_service import BlockchainService
        from app.models.wallet import UserWallet

        seller_wallet = None
        seller_id = prop.creator_user_id or prop.current_owner_id
        if seller_id:
            wallet_rec = self.db.query(UserWallet).filter(UserWallet.user_id == seller_id).first()
            if wallet_rec and wallet_rec.wallet_address:
                seller_wallet = wallet_rec.wallet_address

        if not seller_wallet:
            from app.core.config import get_settings
            settings = get_settings()
            seller_wallet = settings.PLATFORM_CUSTODY_WALLET

        docs = self.doc_repo.list_by_property(property_id)
        valid_docs = [
            d for d in docs
            if (d.status or "").upper() not in {"REJECTED", "REPLACED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION"}
        ]
        primary_hash = None
        title_deed = next((d for d in valid_docs if d.document_type.upper() in {"TITLE_DEED", "SALE_DEED", "DEED"}), None)
        if title_deed and title_deed.document_hash:
            primary_hash = title_deed.document_hash
        else:
            for d in valid_docs:
                if d.document_hash:
                    primary_hash = d.document_hash
                    break

        if not primary_hash or primary_hash == "0x" + "00" * 32:
            raise BadRequestError("Cannot retry blockchain registration: No verified document hash found.")

        bc_service = BlockchainService(self.db)
        bc_success, bc_tx, bc_error = bc_service.anchor_property(prop, seller_wallet, primary_hash)

        if bc_success:
            prop.status = "ACTIVE"
            prop.verification_status = "VERIFIED"
            prop.blockchain_property_id = prop.property_number
            if bc_tx:
                prop.blockchain_tx_hash = bc_tx
            if not prop.verified_at:
                prop.verified_at = datetime.now(timezone.utc)
            if not prop.verified_by_id and user_role in {UserRole.REGISTRAR.value, UserRole.VERIFIER.value}:
                prop.verified_by_id = current_user.id
            updated = self.repo.update(prop)
        else:
            prop.status = "BLOCKCHAIN_FAILED"
            updated = self.repo.update(prop)
            raise BadRequestError(f"Blockchain registration failed: {bc_error or 'EVM network error'}")

        return self._to_response(updated)

    def update_status(
        self,
        property_id: uuid.UUID,
        data: PropertyStatusUpdate,
        current_user: User,
    ) -> PropertyResponse:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")

        raw_role = current_user.role
        user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)

        # Verification status can only be modified by Admin, Verifier, or Legal Authority
        if data.verification_status is not None:
            if user_role not in {UserRole.ADMIN.value, UserRole.REGISTRAR.value, UserRole.VERIFIER.value, UserRole.LEGAL_AUTHORITY.value}:
                raise ForbiddenError("Only authorized verifiers or administrators can alter verification status.")
            target_v_status = data.verification_status.upper()
            if target_v_status == "VERIFIED":
                return self.verify_property(property_id, current_user)
            elif target_v_status in {"IN_REVIEW", "UNDER_REVIEW"}:
                self.validate_required_documents(property_id)
            prop.verification_status = target_v_status

        # Property operational status (e.g. INACTIVE/ACTIVE) can be set by Admin or the owner
        if data.status is not None:
            is_owner = (
                (prop.current_owner_id is not None and str(prop.current_owner_id) == str(current_user.id))
                or (prop.creator_user_id is not None and str(prop.creator_user_id) == str(current_user.id))
            )
            if user_role != UserRole.ADMIN.value and not is_owner:
                raise ForbiddenError("You are not authorized to change the operational status of this property.")
            target_op_status = data.status.upper()
            if target_op_status in {"UNDER_REVIEW", "IN_REVIEW"}:
                self.validate_required_documents(property_id)
            prop.status = target_op_status

        updated = self.repo.update(prop)
        return self._to_response(updated)

