"""
Business logic service for Property Management in PropChain.
"""
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.core.permissions import UserRole, Permission, has_permission
from app.models.property import Property
from app.models.user import User
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


class PropertyService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PropertyRepository(db)

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

    def get_property(self, property_id: uuid.UUID) -> PropertyResponse:
        prop = self.repo.get_by_id(property_id)
        if not prop:
            raise NotFoundError(f"Property with ID '{property_id}' not found.")
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
            prop.verification_status = data.verification_status.upper()

        # Property operational status (e.g. INACTIVE/ACTIVE) can be set by Admin or the owner
        if data.status is not None:
            is_owner = prop.current_owner_id == current_user.id or prop.creator_user_id == current_user.id
            if user_role != UserRole.ADMIN and not is_owner:
                raise ForbiddenError("You are not authorized to change the operational status of this property.")
            prop.status = data.status.upper()

        updated = self.repo.update(prop)
        return self._to_response(updated)

