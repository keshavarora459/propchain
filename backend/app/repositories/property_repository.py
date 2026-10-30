"""
Repository for Property database operations in PropChain.
"""
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session, joinedload

from app.models.property import Property


class PropertyRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, prop: Property) -> Property:
        self.db.add(prop)
        self.db.commit()
        self.db.refresh(prop)
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
        state: str,
        city: str,
        postal_code: str,
        street_address: str,
        survey_number: Optional[str] = None,
        ulpin: Optional[str] = None,
        registration_number: Optional[str] = None,
    ) -> Optional[Property]:
        """
        Detects likely duplicate property records using cadastral identifiers
        or an exact match of location and street address.
        """
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
    ) -> Tuple[List[Property], int]:
        stmt = select(Property).options(
            joinedload(Property.current_owner),
            joinedload(Property.creator),
        )

        filters = []
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

        if owner_id:
            filters.append(Property.current_owner_id == owner_id)

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
        return prop

