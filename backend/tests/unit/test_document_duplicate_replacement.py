"""
Unit tests for Document Duplicate Upload Prevention and Document Replacement Lifecycle.

Tests:
1. Duplicate hash on the same property is rejected with 409 ("This file is already uploaded for this property.")
2. Duplicate hash on a different property is permitted.
3. Uploading the same document type while one is already pending/active is blocked (409).
4. Uploading the same document type is allowed if the previous document was REJECTED;
   the previous document is marked as REPLACED and the new document becomes active.
5. Uploading the same document type is allowed if the previous document was CORRECTION_REQUESTED;
   the previous document is marked as REPLACED.
6. Re-uploading a file with the same hash is allowed if the previous document was REJECTED/REPLACED.
"""
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.exceptions import ConflictError
from app.core.permissions import UserRole, AccountStatus
from app.models.base import Base
from app.models.document import PropertyDocument
from app.models.property import Property
from app.models.user import User
from app.services.document_service import DocumentService, are_same_document_type


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
def test_setup(db_session):
    owner = User(
        id=uuid.uuid4(),
        full_name="Deed Owner User",
        email=f"owner_{uuid.uuid4().hex[:6]}@propchain.network",
        password_hash="fakehash",
        role=UserRole.PROPERTY_OWNER.value,
        account_status=AccountStatus.ACTIVE.value,
        email_verified=True,
    )
    db_session.add(owner)
    db_session.commit()

    prop1 = Property(
        id=uuid.uuid4(),
        property_number="PROP-DOC-001",
        title="Estate Alpha",
        property_type="RESIDENTIAL",
        country="India",
        state="Punjab",
        city="Amritsar",
        street_address="123 Heritage Way",
        postal_code="143001",
        land_area=Decimal("1500.0"),
        valuation=250000.0,
        status="ACTIVE",
        verification_status="PENDING",
        current_owner_id=owner.id,
        creator_user_id=owner.id,
    )
    prop2 = Property(
        id=uuid.uuid4(),
        property_number="PROP-DOC-002",
        title="Estate Beta",
        property_type="RESIDENTIAL",
        country="India",
        state="Punjab",
        city="Jalandhar",
        street_address="456 Grand Trunk Road",
        postal_code="144001",
        land_area=Decimal("2000.0"),
        valuation=350000.0,
        status="ACTIVE",
        verification_status="PENDING",
        current_owner_id=owner.id,
        creator_user_id=owner.id,
    )
    db_session.add_all([prop1, prop2])
    db_session.commit()

    return {"owner": owner, "prop1": prop1, "prop2": prop2}


def test_are_same_document_type_helper():
    assert are_same_document_type("TITLE_DEED", "TITLE_DEED") is True
    assert are_same_document_type("title_deed", "TITLE_DEED") is True
    assert are_same_document_type("TITLE_DEED", "SALE_DEED") is True
    assert are_same_document_type("CADASTRAL_SURVEY", "SURVEY_PLAN") is True
    assert are_same_document_type("TAX_CLEARANCE", "TAX_RECEIPT") is True
    assert are_same_document_type("TITLE_DEED", "CADASTRAL_SURVEY") is False


def test_duplicate_hash_rejected_with_409(db_session, test_setup):
    service = DocumentService(db_session)
    owner = test_setup["owner"]
    prop1 = test_setup["prop1"]

    content = b"%PDF-1.4 Unique Document Content Alpha"
    doc1 = service.upload_document(
        property_id=prop1.id,
        file_content=content,
        original_filename="deed.pdf",
        mime_type="application/pdf",
        document_type="TITLE_DEED",
        title="Title Deed Alpha",
        current_user=owner,
    )
    assert doc1.status == "PENDING_REVIEW"

    # Attempting to upload the exact same file content for the same property must raise 409 Conflict
    with pytest.raises(ConflictError) as exc_info:
        service.upload_document(
            property_id=prop1.id,
            file_content=content,
            original_filename="deed_duplicate.pdf",
            mime_type="application/pdf",
            document_type="CADASTRAL_SURVEY",  # Different type, but same hash
            title="Duplicate File",
            current_user=owner,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.message == "This file is already uploaded for this property."


def test_duplicate_hash_allowed_across_different_properties(db_session, test_setup):
    service = DocumentService(db_session)
    owner = test_setup["owner"]
    prop1 = test_setup["prop1"]
    prop2 = test_setup["prop2"]

    content = b"%PDF-1.4 Shared Template Content"
    doc1 = service.upload_document(
        property_id=prop1.id,
        file_content=content,
        original_filename="survey_prop1.pdf",
        mime_type="application/pdf",
        document_type="CADASTRAL_SURVEY",
        title="Survey Prop 1",
        current_user=owner,
    )
    assert doc1.status == "PENDING_REVIEW"

    # Same file on a DIFFERENT property is allowed
    doc2 = service.upload_document(
        property_id=prop2.id,
        file_content=content,
        original_filename="survey_prop2.pdf",
        mime_type="application/pdf",
        document_type="CADASTRAL_SURVEY",
        title="Survey Prop 2",
        current_user=owner,
    )
    assert doc2.status == "PENDING_REVIEW"
    assert doc2.document_hash == doc1.document_hash


def test_same_type_blocked_while_pending(db_session, test_setup):
    service = DocumentService(db_session)
    owner = test_setup["owner"]
    prop1 = test_setup["prop1"]

    content_a = b"%PDF-1.4 Title Deed Version 1"
    doc1 = service.upload_document(
        property_id=prop1.id,
        file_content=content_a,
        original_filename="title_v1.pdf",
        mime_type="application/pdf",
        document_type="TITLE_DEED",
        title="Title Deed",
        current_user=owner,
    )
    assert doc1.status == "PENDING_REVIEW"

    # Attempt to upload another document of same type (or alias SALE_DEED) while pending
    content_b = b"%PDF-1.4 Title Deed Different Content"
    with pytest.raises(ConflictError) as exc_info:
        service.upload_document(
            property_id=prop1.id,
            file_content=content_b,
            original_filename="sale_deed_v2.pdf",
            mime_type="application/pdf",
            document_type="SALE_DEED",  # Alias of TITLE_DEED
            title="Sale Deed Again",
            current_user=owner,
        )

    assert exc_info.value.status_code == 409
    assert "already uploaded for this property" in exc_info.value.message


def test_same_type_allowed_after_rejection_and_old_becomes_replaced(db_session, test_setup):
    service = DocumentService(db_session)
    owner = test_setup["owner"]
    prop1 = test_setup["prop1"]

    content_v1 = b"%PDF-1.4 Survey First Version"
    doc1 = service.upload_document(
        property_id=prop1.id,
        file_content=content_v1,
        original_filename="survey_v1.pdf",
        mime_type="application/pdf",
        document_type="CADASTRAL_SURVEY",
        title="Cadastral Survey",
        current_user=owner,
    )
    assert doc1.status == "PENDING_REVIEW"
    assert doc1.version == 1

    # Simulate Verifier rejecting the document
    raw_doc1 = db_session.get(PropertyDocument, doc1.id)
    raw_doc1.status = "REJECTED"
    db_session.commit()

    # Now upload the replacement document of the same type
    content_v2 = b"%PDF-1.4 Survey Corrected Version 2"
    doc2 = service.upload_document(
        property_id=prop1.id,
        file_content=content_v2,
        original_filename="survey_v2.pdf",
        mime_type="application/pdf",
        document_type="CADASTRAL_SURVEY",
        title="Cadastral Survey Corrected",
        current_user=owner,
    )
    assert doc2.status == "PENDING_REVIEW"
    assert doc2.version == 2

    # Verify the old document transitioned to REPLACED
    db_session.refresh(raw_doc1)
    assert raw_doc1.status == "REPLACED"


def test_same_type_allowed_after_correction_requested_and_old_becomes_replaced(db_session, test_setup):
    service = DocumentService(db_session)
    owner = test_setup["owner"]
    prop1 = test_setup["prop1"]

    content_v1 = b"%PDF-1.4 Tax Receipt Original"
    doc1 = service.upload_document(
        property_id=prop1.id,
        file_content=content_v1,
        original_filename="tax_clearance.pdf",
        mime_type="application/pdf",
        document_type="TAX_CLEARANCE",
        title="Tax Clearance",
        current_user=owner,
    )
    assert doc1.status == "PENDING_REVIEW"

    # Mark document as requiring correction
    raw_doc1 = db_session.get(PropertyDocument, doc1.id)
    raw_doc1.status = "CORRECTION_REQUESTED"
    db_session.commit()

    # Upload corrected document
    content_v2 = b"%PDF-1.4 Tax Receipt Updated Stamp"
    doc2 = service.upload_document(
        property_id=prop1.id,
        file_content=content_v2,
        original_filename="tax_clearance_fixed.pdf",
        mime_type="application/pdf",
        document_type="TAX_RECEIPT",  # Alias
        title="Tax Receipt Fixed",
        current_user=owner,
    )
    assert doc2.status == "PENDING_REVIEW"
    assert doc2.version == 2

    db_session.refresh(raw_doc1)
    assert raw_doc1.status == "REPLACED"


def test_duplicate_hash_allowed_if_previous_was_rejected(db_session, test_setup):
    service = DocumentService(db_session)
    owner = test_setup["owner"]
    prop1 = test_setup["prop1"]

    content = b"%PDF-1.4 Encumbrance Certificate Content"
    doc1 = service.upload_document(
        property_id=prop1.id,
        file_content=content,
        original_filename="encumbrance.pdf",
        mime_type="application/pdf",
        document_type="ENCUMBRANCE_CERTIFICATE",
        title="Encumbrance Certificate",
        current_user=owner,
    )

    # Reject doc1
    raw_doc1 = db_session.get(PropertyDocument, doc1.id)
    raw_doc1.status = "REJECTED"
    db_session.commit()

    # Re-uploading (even with same hash) does not fail with duplicate error on inactive/rejected doc
    doc2 = service.upload_document(
        property_id=prop1.id,
        file_content=content,
        original_filename="encumbrance_reuploaded.pdf",
        mime_type="application/pdf",
        document_type="ENCUMBRANCE_CERTIFICATE",
        title="Encumbrance Certificate Resubmitted",
        current_user=owner,
    )
    assert doc2.status == "PENDING_REVIEW"
    db_session.refresh(raw_doc1)
    assert raw_doc1.status == "REPLACED"
