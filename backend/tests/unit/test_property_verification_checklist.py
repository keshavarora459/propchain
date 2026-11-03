"""
Unit tests for Property Verification Required Documents Checklist and Rule.
Verifies:
- All 4 required document types: TITLE_DEED, CADASTRAL_SURVEY, TAX_CLEARANCE, ENCUMBRANCE_CERTIFICATE
- Aliases (SALE_DEED, SURVEY_PLAN, TAX_RECEIPT) are properly mapped
- submit_for_verification and update_status block properties when documents are missing
- Clear error message lists missing document types
"""
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.exceptions import BadRequestError, ForbiddenError
from app.core.permissions import UserRole, AccountStatus
from app.models.base import Base
from app.models.document import PropertyDocument
from app.models.property import Property
from app.models.user import User
from app.schemas.property import PropertyStatusUpdate
from app.services.property_service import PropertyService, REQUIRED_PROPERTY_DOC_SPECS


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def users_and_prop(db_session):
    owner = User(
        id=uuid.uuid4(),
        full_name="Property Owner User",
        email=f"owner_{uuid.uuid4().hex[:6]}@propchain.network",
        password_hash="fakehash",
        role=UserRole.PROPERTY_OWNER.value,
        account_status=AccountStatus.ACTIVE.value,
        email_verified=True,
    )
    other_owner = User(
        id=uuid.uuid4(),
        full_name="Other Owner",
        email=f"other_{uuid.uuid4().hex[:6]}@propchain.network",
        password_hash="fakehash",
        role=UserRole.PROPERTY_OWNER.value,
        account_status=AccountStatus.ACTIVE.value,
        email_verified=True,
    )
    verifier = User(
        id=uuid.uuid4(),
        full_name="Verifier Admin",
        email=f"verifier_{uuid.uuid4().hex[:6]}@propchain.network",
        password_hash="fakehash",
        role=UserRole.VERIFIER.value,
        account_status=AccountStatus.ACTIVE.value,
        email_verified=True,
    )
    db_session.add_all([owner, other_owner, verifier])
    db_session.commit()

    prop = Property(
        id=uuid.uuid4(),
        property_number="PROP-TEST-001",
        title="Checklist Test Estate",
        property_type="RESIDENTIAL",
        country="India",
        state="Maharashtra",
        city="Mumbai",
        street_address="100 Marine Drive",
        postal_code="400001",
        land_area=Decimal("1200.00"),
        valuation=Decimal("400000.00"),
        creator_user_id=owner.id,
        current_owner_id=owner.id,
        status="ACTIVE",
        verification_status="PENDING",
    )
    db_session.add(prop)
    db_session.commit()
    return owner, other_owner, verifier, prop


def _add_doc(db_session, prop_id, uploader_id, doc_type, status="PENDING_REVIEW"):
    doc = PropertyDocument(
        id=uuid.uuid4(),
        property_id=prop_id,
        uploader_user_id=uploader_id,
        document_type=doc_type,
        title=f"{doc_type} Document",
        original_filename=f"{doc_type.lower()}.pdf",
        storage_path=f"/fake/{doc_type.lower()}.pdf",
        file_size=1024,
        mime_type="application/pdf",
        document_hash=uuid.uuid4().hex + uuid.uuid4().hex,
        status=status,
    )
    db_session.add(doc)
    db_session.commit()
    return doc


def test_missing_all_required_documents_raises_error(db_session, users_and_prop):
    owner, _, verifier, prop = users_and_prop
    service = PropertyService(db_session)

    # With 0 documents, validate_required_documents must fail listing all 4
    with pytest.raises(BadRequestError) as exc_info:
        service.validate_required_documents(prop.id)
    msg = str(exc_info.value.message)
    assert "Missing required documents" in msg
    assert "TITLE_DEED" in msg
    assert "CADASTRAL_SURVEY" in msg
    assert "TAX_CLEARANCE" in msg
    assert "ENCUMBRANCE_CERTIFICATE" in msg

    # Verifier trying to mark VERIFIED must fail
    with pytest.raises(BadRequestError) as exc_info2:
        service.update_status(
            prop.id,
            PropertyStatusUpdate(verification_status="VERIFIED"),
            verifier,
        )
    assert "Missing required documents" in str(exc_info2.value.message)


def test_missing_partial_required_documents(db_session, users_and_prop):
    owner, _, _, prop = users_and_prop
    service = PropertyService(db_session)

    # Upload only TITLE_DEED and TAX_CLEARANCE
    _add_doc(db_session, prop.id, owner.id, "TITLE_DEED")
    _add_doc(db_session, prop.id, owner.id, "TAX_CLEARANCE")

    with pytest.raises(BadRequestError) as exc_info:
        service.validate_required_documents(prop.id)
    msg = str(exc_info.value.message)
    assert "CADASTRAL_SURVEY" in msg
    assert "ENCUMBRANCE_CERTIFICATE" in msg
    assert "TITLE_DEED" not in msg
    assert "TAX_CLEARANCE" not in msg


def test_submit_for_verification_success_when_all_uploaded(db_session, users_and_prop):
    owner, _, verifier, prop = users_and_prop
    service = PropertyService(db_session)

    # Upload all 4 types using canonical names and aliases
    _add_doc(db_session, prop.id, owner.id, "SALE_DEED")  # Alias for TITLE_DEED
    _add_doc(db_session, prop.id, owner.id, "SURVEY_PLAN")  # Alias for CADASTRAL_SURVEY
    _add_doc(db_session, prop.id, owner.id, "TAX_RECEIPT")  # Alias for TAX_CLEARANCE
    _add_doc(db_session, prop.id, owner.id, "ENCUMBRANCE_CERTIFICATE")

    # Should validate without error
    service.validate_required_documents(prop.id)

    # Checklist status should report all_uploaded = True
    status_data = service.get_required_documents_status(prop.id, owner)
    assert status_data["all_uploaded"] is True
    assert status_data["uploaded_count"] == 4
    assert len(status_data["missing"]) == 0

    # Submit for verification
    res = service.submit_for_verification(prop.id, owner)
    assert res.verification_status == "PENDING"
    assert res.status == "UNDER_REVIEW"

    # Verifier can now approve verification status
    res_verified = service.update_status(
        prop.id,
        PropertyStatusUpdate(verification_status="VERIFIED"),
        verifier,
    )
    assert res_verified.verification_status == "VERIFIED"


def test_rejected_document_does_not_count_as_fulfilled(db_session, users_and_prop):
    owner, _, _, prop = users_and_prop
    service = PropertyService(db_session)

    _add_doc(db_session, prop.id, owner.id, "TITLE_DEED")
    _add_doc(db_session, prop.id, owner.id, "CADASTRAL_SURVEY")
    _add_doc(db_session, prop.id, owner.id, "TAX_CLEARANCE")
    # ENCUMBRANCE_CERTIFICATE was rejected during audit
    _add_doc(db_session, prop.id, owner.id, "ENCUMBRANCE_CERTIFICATE", status="REJECTED")

    with pytest.raises(BadRequestError) as exc_info:
        service.validate_required_documents(prop.id)
    assert "ENCUMBRANCE_CERTIFICATE" in str(exc_info.value.message)


def test_submit_unauthorized_user_blocked(db_session, users_and_prop):
    owner, other_owner, _, prop = users_and_prop
    service = PropertyService(db_session)

    # Add all docs
    _add_doc(db_session, prop.id, owner.id, "TITLE_DEED")
    _add_doc(db_session, prop.id, owner.id, "CADASTRAL_SURVEY")
    _add_doc(db_session, prop.id, owner.id, "TAX_CLEARANCE")
    _add_doc(db_session, prop.id, owner.id, "ENCUMBRANCE_CERTIFICATE")

    # Non-owner cannot submit someone else's property
    with pytest.raises(ForbiddenError):
        service.submit_for_verification(prop.id, other_owner)

