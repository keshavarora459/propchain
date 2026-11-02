"""
Seed Default Properties for PropChain.
Provisions the 5 core real estate parcels if the local database has 0 properties.
"""
from decimal import Decimal
import uuid

from app.core.database import get_session_factory
from app.models.property import Property
from app.models.user import User

DEMO_PROPERTIES = [
    {
        "id": uuid.UUID("f8cac1e0-d3e4-4205-bfe8-7cb6d7150599"),
        "property_number": "PROP-2026-46274",
        "title": "Twin tower",
        "description": "Twin tower located at ranjit avenue, amritsar",
        "property_type": "RESIDENTIAL",
        "property_category": "LAND_PARCEL",
        "country": "India",
        "state": "punjab",
        "city": "amritsar",
        "street_address": "ranjit avenue",
        "postal_code": "143001",
        "land_area": Decimal("4500.0"),
        "area_unit": "SQ_FT",
        "valuation": Decimal("120000.00"),
        "registration_number": "kjdfhuk7j",
        "verification_status": "VERIFIED",
        "status": "ACTIVE",
    },
    {
        "id": uuid.UUID("590b9e70-d5b3-40d2-b43c-1d89758e7afd"),
        "property_number": "PROP-2026-47255",
        "title": "antilia",
        "description": "Luxury landmark residential parcel in Mumbai",
        "property_type": "RESIDENTIAL",
        "property_category": "LAND_PARCEL",
        "country": "India",
        "state": "mh",
        "city": "mumbai",
        "street_address": "450 d",
        "postal_code": "400026",
        "land_area": Decimal("49000.0"),
        "area_unit": "SQ_FT",
        "valuation": Decimal("10000000.00"),
        "registration_number": "REG-MUM-9981",
        "verification_status": "VERIFIED",
        "status": "ACTIVE",
    },
    {
        "id": uuid.UUID("55bd9a22-9f08-462b-aa85-534f62d341a9"),
        "property_number": "PROP-2026-13277",
        "title": "Silicon Valley Prime Commercial Parcel",
        "description": "Grade-A institutional office & research campus parcel",
        "property_type": "COMMERCIAL",
        "property_category": "OFFICE_SPACE",
        "country": "United States",
        "state": "California",
        "city": "San Jose",
        "street_address": "450 Innovation Parkway",
        "postal_code": "95134",
        "land_area": Decimal("120000.0"),
        "area_unit": "SQ_FT",
        "valuation": Decimal("4500000.00"),
        "registration_number": "CA-SCL-2026-09823",
        "verification_status": "VERIFIED",
        "status": "ACTIVE",
    },
    {
        "id": uuid.UUID("688fff97-7a4e-42cf-9dc1-15e50624dc46"),
        "property_number": "PROP-2026-95045",
        "title": "skyscarper",
        "description": "Commercial high-rise parcel",
        "property_type": "COMMERCIAL",
        "property_category": "LAND_PARCEL",
        "country": "India",
        "state": "pb",
        "city": "ame",
        "street_address": "450 bhagtan wla",
        "postal_code": "143001",
        "land_area": Decimal("8000.0"),
        "area_unit": "SQ_FT",
        "valuation": Decimal("387000.00"),
        "registration_number": "REG-SKYS-45",
        "verification_status": "VERIFIED",
        "status": "ACTIVE",
    },
    {
        "id": uuid.UUID("24b4bde4-1054-4616-827d-62522ff90ca6"),
        "property_number": "PROP-2026-69459",
        "title": "abc",
        "description": "Prime residential parcel near Golden Temple",
        "property_type": "RESIDENTIAL",
        "property_category": "LAND_PARCEL",
        "country": "India",
        "state": "Punjab",
        "city": "Amritsar",
        "street_address": "golden temple",
        "postal_code": "143001",
        "land_area": Decimal("5000.0"),
        "area_unit": "SQ_FT",
        "valuation": Decimal("12000000.00"),
        "registration_number": "REG-GT-77",
        "verification_status": "PENDING",
        "status": "ACTIVE",
    },
]


def seed_demo_properties():
    session_factory = get_session_factory()
    with session_factory() as db:
        admin_user = db.query(User).filter(User.email == "admin@propchain.network").first()
        admin_id = admin_user.id if admin_user else None

        for p_data in DEMO_PROPERTIES:
            existing = db.query(Property).filter(Property.id == p_data["id"]).first()
            if not existing:
                prop = Property(
                    **p_data,
                    creator_user_id=admin_id,
                    current_owner_id=admin_id,
                )
                db.add(prop)
        db.commit()
    print("Demo properties successfully seeded.")
