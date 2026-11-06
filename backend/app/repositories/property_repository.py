"""
Repository for Property database operations in PropChain.
"""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.logging import get_logger
from app.core.permissions import UserRole
from app.models.property import Property
from app.models.user import User

logger = get_logger("repositories.property")


class PropertyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, prop: Property) -> Property:
        self.db.add(prop)
        self.db.commit()
        self.db.refresh(prop)
        try:
            from app.core.mongo import sync_entity_to_mongo
            sync_entity_to_mongo(prop)
        except Exception as e:
            logger.debug("Immediate MongoDB sync notice on create: %s", e)
        return prop

    def get_by_id(self, property_id: uuid.UUID) -> Optional[Property]:
        stmt = (
            select(Property)
            .options(joinedload(Property.current_owner), joinedload(Property.creator))
            .where(Property.id == property_id)
        )
        return self.db.scalars(stmt).first()

    def get_by_property_number(self, property_number: str) -> Optional[Property]:
        stmt = select(Property).where(Property.property_number == property_number)
        return self.db.scalars(stmt).first()

    def find_duplicate(
        self,
        survey_number: Optional[str] = None,
        ulpin: Optional[str] = None,
        registration_number: Optional[str] = None,
        state: str = "",
        city: str = "",
        postal_code: str = "",
        street_address: str = "",
    ) -> Optional[Property]:
        conditions = []

        if ulpin and ulpin.strip():
            conditions.append(Property.ulpin == ulpin.strip())

        if registration_number and registration_number.strip():
            conditions.append(Property.registration_number == registration_number.strip())

        if survey_number and survey_number.strip():
            conditions.append(
                (Property.survey_number == survey_number.strip())
                & (Property.state == state.strip())
                & (Property.city == city.strip())
            )

        # Address match
        conditions.append(
            (Property.state.ilike(state.strip()))
            & (Property.city.ilike(city.strip()))
            & (Property.postal_code == postal_code.strip())
            & (Property.street_address.ilike(street_address.strip()))
        )

        stmt = select(Property).where(or_(*conditions))
        return self.db.scalars(stmt).first()

    def list_properties(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        property_type: Optional[str] = None,
        status: Optional[str] = None,
        verification_status: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        owner_id: Optional[uuid.UUID] = None,
        creator_id: Optional[uuid.UUID] = None,
        current_user: Optional[User] = None,
        verified_by_me: Optional[bool] = False,
    ) -> Tuple[List[Property], int]:
        stmt = select(Property).options(
            joinedload(Property.current_owner),
            joinedload(Property.creator),
        )

        filters = []

        # Role-based privacy scoping
        if current_user is not None:
            raw_role = current_user.role
            user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)
            if user_role == UserRole.PROPERTY_OWNER.value:
                # PROPERTY_OWNER can ONLY see:
                # 1. Properties they currently own, plus
                # 2. Properties that are verified and active (marketplace listings)
                filters.append(
                    or_(
                        Property.current_owner_id == current_user.id,
                        and_(
                            Property.current_owner_id.is_(None),
                            Property.creator_user_id == current_user.id,
                        ),
                        and_(
                            Property.verification_status == "VERIFIED",
                            Property.status == "ACTIVE",
                        ),
                    )
                )
            elif user_role == UserRole.BUYER.value:
                # BUYER can only see active verified marketplace listings (or properties they own)
                filters.append(
                    or_(
                        and_(
                            Property.verification_status == "VERIFIED",
                            Property.status == "ACTIVE",
                        ),
                        Property.current_owner_id == current_user.id,
                        Property.creator_user_id == current_user.id,
                    )
                )
            elif user_role in {UserRole.REGISTRAR.value, UserRole.VERIFIER.value, "REGISTRAR", "VERIFIER"}:
                # Verifier can view properties across verification lifecycle
                filters.append(
                    Property.verification_status.in_([
                        "SUBMITTED", "CORRECTION_REQUESTED", "REQUIRES_CORRECTION", "REJECTED", "VERIFIED"
                    ])
                )
            # ADMIN, LEGAL_AUTHORITY remain unrestricted

        if search and search.strip():
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Property.title.ilike(term),
                    Property.property_number.ilike(term),
                    Property.city.ilike(term),
                    Property.state.ilike(term),
                    Property.street_address.ilike(term),
                    Property.survey_number.ilike(term),
                    Property.ulpin.ilike(term),
                )
            )

        if property_type and property_type.strip():
            filters.append(Property.property_type.ilike(property_type.strip()))

        if status and status.strip():
            filters.append(Property.status == status.strip().upper())

        if verification_status and verification_status.strip():
            filters.append(Property.verification_status == verification_status.strip().upper())

        if state and state.strip():
            filters.append(Property.state.ilike(state.strip()))

        if city and city.strip():
            filters.append(Property.city.ilike(city.strip()))

        if verified_by_me and current_user is not None:
            from app.models.document import DocumentVerificationRecord, PropertyDocument
            verified_by_me_subq = (
                select(PropertyDocument.property_id)
                .join(DocumentVerificationRecord, DocumentVerificationRecord.document_id == PropertyDocument.id)
                .where(DocumentVerificationRecord.verifier_user_id == current_user.id)
            )
            filters.append(
                or_(
                    Property.verified_by_id == current_user.id,
                    Property.id.in_(verified_by_me_subq),
                )
            )

        if owner_id:
            filters.append(
                or_(
                    Property.current_owner_id == owner_id,
                    and_(
                        Property.current_owner_id.is_(None),
                        Property.creator_user_id == owner_id,
                    ),
                )
            )

        if creator_id:
            filters.append(Property.creator_user_id == creator_id)

        if filters:
            stmt = stmt.where(*filters)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = self.db.scalar(count_stmt) or 0

        # Order and paginate
        stmt = stmt.order_by(Property.created_at.desc()).offset(skip).limit(limit)
        items = list(self.db.scalars(stmt).unique().all())

        return items, total

    def update(self, prop: Property) -> Property:
        self.db.commit()
        self.db.refresh(prop)
        try:
            from app.core.mongo import sync_entity_to_mongo
            sync_entity_to_mongo(prop)
        except Exception as e:
            logger.debug("Immediate MongoDB sync notice on update: %s", e)
        return prop

    def delete(self, property_id: uuid.UUID) -> bool:
        prop = self.get_by_id(property_id)
        if not prop:
            return False

        from app.models.approval import TransactionApproval
        from app.models.transaction import PropertyTransaction
        from app.models.document import PropertyDocument
        from app.models.blockchain import OwnershipEvent

        txs = self.db.query(PropertyTransaction).filter(PropertyTransaction.property_id == property_id).all()
        for tx in txs:
            self.db.query(TransactionApproval).filter(TransactionApproval.transaction_id == tx.id).delete()
            self.db.delete(tx)
        self.db.query(PropertyDocument).filter(PropertyDocument.property_id == property_id).delete()
        self.db.query(OwnershipEvent).filter(OwnershipEvent.property_id == property_id).delete()

        self.db.delete(prop)
        self.db.commit()

        # Explicitly purge from MongoDB Atlas collections
        try:
            from app.core.mongo import get_mongo_db
            mongo_db = get_mongo_db()
            if mongo_db is not None:
                str_id = str(property_id)
                mongo_db["properties"].delete_one({"_id": str_id})
                mongo_db["documents"].delete_many({"property_id": str_id})
                mongo_db["transactions"].delete_many({"property_id": str_id})
                mongo_db["ownership_events"].delete_many({"property_id": str_id})
        except Exception:
            pass

        return True
