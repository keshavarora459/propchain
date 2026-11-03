"""
Business logic service for Property Management in PropChain.
"""
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.permissions import UserRole, Permission, has_permission, assert_property_access
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

        resp = PropertyResponse.model_validate(prop)
        resp.owner_name = owner_name
        resp.owner_email = owner_email
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
            status="ACTIVE",
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
        current_user: Optional[User] = None,
    ) -> PropertyListResponse:
        skip = (page - 1) * page_size
        items, total = self.repo.list_properties(
            skip=skip,
            limit=page_size,
            search=search,
            property_type=property_type,
            status=status,
            verification_status=verification_status,
            state=state,
            city=city,
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
        valid_docs = [d for d in docs if (d.status or "").upper() != "REJECTED"]
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
        valid_docs = [d for d in docs if (d.status or "").upper() != "REJECTED"]

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

        user_role = UserRole(current_user.role)
        is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
        if user_role != UserRole.ADMIN and not is_owner:
            raise ForbiddenError("You are not authorized to submit this property for verification.")

        self.validate_required_documents(property_id)

        prop.verification_status = "PENDING"
        prop.status = "UNDER_REVIEW"
        updated = self.repo.update(prop)
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

        user_role = UserRole(current_user.role)

        # Verification status can only be modified by Admin, Verifier, or Legal Authority
        if data.verification_status is not None:
            if user_role not in {UserRole.ADMIN, UserRole.VERIFIER, UserRole.LEGAL_AUTHORITY}:
                raise ForbiddenError("Only authorized verifiers or administrators can alter verification status.")
            target_v_status = data.verification_status.upper()
            if target_v_status in {"VERIFIED", "IN_REVIEW", "UNDER_REVIEW"}:
                self.validate_required_documents(property_id)
            prop.verification_status = target_v_status

        # Property operational status (e.g. INACTIVE/ACTIVE) can be set by Admin or the owner
        if data.status is not None:
            is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
            if user_role != UserRole.ADMIN and not is_owner:
                raise ForbiddenError("You are not authorized to change the operational status of this property.")
            target_op_status = data.status.upper()
            if target_op_status in {"UNDER_REVIEW", "IN_REVIEW"}:
                self.validate_required_documents(property_id)
            prop.status = target_op_status

        updated = self.repo.update(prop)
        return self._to_response(updated)

