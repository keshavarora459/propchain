"""
Unit tests for live MongoDB -> SQLite reconciliation (side-by-side sync without server restart).
"""
from datetime import date, datetime, timezone
from decimal import Decimal
import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.core.mongo as mongo_mod
from app.models.base import Base
from app.models.document import DocumentVerificationRecord, PropertyDocument
from app.models.property import Property
from app.models.user import User


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, keys):
        # Supports sort([("updated_at", -1), ("created_at", -1)])
        for field, direction in reversed(keys):
            self._docs.sort(
                key=lambda d: str(d.get(field) or ""),
                reverse=(direction < 0),
            )
        return self

    def __iter__(self):
        return iter(self._docs)


class _FakeCollection:
    def __init__(self, initial=None):
        self.docs = {str(d["_id"]): dict(d) for d in (initial or [])}
        self.writes = 0

    def find(self):
        return _FakeCursor([dict(d) for d in self.docs.values()])

    def replace_one(self, flt, doc, upsert=False):
        self.writes += 1
        key = str(flt["_id"])
        if key in self.docs or upsert:
            self.docs[key] = dict(doc)

    def delete_one(self, flt):
        self.writes += 1
        self.docs.pop(str(flt["_id"]), None)


class _FakeMongoDB:
    def __init__(self):
        self._cols = {}

    def __getitem__(self, name):
        if name not in self._cols:
            self._cols[name] = _FakeCollection()
        return self._cols[name]


@pytest.fixture
def isolated_sync_env():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    fake_db = _FakeMongoDB()

    # Reset module pull timestamp before each test
    mongo_mod._last_mongo_pull_ts = 0.0
    mongo_mod._last_mongo_snapshot_digests.clear()
    with mongo_mod._failed_push_lock:
        mongo_mod._failed_push_ids.clear()

    yield SessionLocal, fake_db

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_live_sync_inserts_updates_deletes_and_suppresses_echo(isolated_sync_env):
    SessionLocal, fake_db = isolated_sync_env

    canonical_seller_id = uuid.uuid4()
    dup_seller_id = uuid.uuid4()
    verifier_id = uuid.uuid4()

    now_dt = datetime(2026, 11, 10, 3, 20, 0, tzinfo=timezone.utc)
    old_dt = datetime(2026, 11, 1, 8, 0, 0, tzinfo=timezone.utc)

    # Duplicate seller emails in MongoDB (older duplicate must alias to canonical ID)
    fake_db["users"].docs[str(canonical_seller_id)] = {
        "_id": str(canonical_seller_id),
        "id": str(canonical_seller_id),
        "full_name": "Seller Account",
        "email": "seller@propchain.network",
        "password_hash": "hash1",
        "role": "PROPERTY_OWNER",
        "account_status": "ACTIVE",
        "email_verified": True,
        "created_at": old_dt,
        "updated_at": now_dt,
    }
    fake_db["users"].docs[str(dup_seller_id)] = {
        "_id": str(dup_seller_id),
        "id": str(dup_seller_id),
        "full_name": "Older Seller",
        "email": "seller@propchain.network",
        "password_hash": "hash1",
        "role": "PROPERTY_OWNER",
        "account_status": "ACTIVE",
        "email_verified": True,
        "created_at": old_dt,
        "updated_at": old_dt,
    }
    fake_db["users"].docs[str(verifier_id)] = {
        "_id": str(verifier_id),
        "id": str(verifier_id),
        "full_name": "Title Verifier",
        "email": "verifier@propchain.network",
        "password_hash": "hash2",
        "role": "VERIFIER",
        "account_status": "ACTIVE",
        "email_verified": True,
        "created_at": now_dt,
        "updated_at": now_dt,
    }

    prop_1_id = uuid.uuid4()
    fake_db["properties"].docs[str(prop_1_id)] = {
        "_id": str(prop_1_id),
        "id": str(prop_1_id),
        "property_number": "PROP-2026-11111",
        "title": "Star Tower",
        "property_type": "COMMERCIAL",
        "property_category": "TOKENIZED",
        "country": "India",
        "state": "MH",
        "city": "Mumbai",
        "street_address": "450 Bandra",
        "postal_code": "400050",
        "land_area": 45000.0,
        "area_unit": "SQ_FT",
        "valuation": 100.0,
        "registration_date": "2026-11-10",
        "creator_user_id": str(canonical_seller_id),
        "current_owner_id": str(canonical_seller_id),
        "status": "ACTIVE",
        "verification_status": "VERIFIED",
        "created_at": now_dt,
        "updated_at": now_dt,
    }

    # Initial hydration
    with SessionLocal() as session:
        counts = mongo_mod.hydrate_all_from_mongo(session, mongo_db=fake_db)
        assert counts["properties"] == 1
        assert counts["users"] == 2
        verifier_row = session.get(User, verifier_id)
        assert verifier_row is not None and verifier_row.role == "REGISTRAR"

    # Attach an echo detector on Session after_flush to verify _skip_mongo_replication=True
    echo_events = []

    @event.listens_for(SessionLocal, "after_flush")
    def _track_echo(session, flush_context):
        if not session.info.get("_skip_mongo_replication"):
            echo_events.append((len(session.new), len(session.dirty), len(session.deleted)))

    # 1) Throttled call immediately after hydration returns fresh without rescanning
    res_fresh = mongo_mod.sync_from_mongo_if_stale(
        min_interval_seconds=60.0,
        mongo_db=fake_db,
        session_factory_override=SessionLocal,
    )
    assert res_fresh["synced"] is False
    assert res_fresh["reason"] == "fresh"

    # 2) Side-by-side insert in MongoDB directly (using duplicate seller ID + Atlas ObjectId doc!)
    prop_2_id = uuid.uuid4()
    doc_2_id = uuid.uuid4()
    fake_db["properties"].docs[str(prop_2_id)] = {
        "_id": str(prop_2_id),
        "id": str(prop_2_id),
        "property_number": "PROP-2026-22222",
        "title": "Commercial Center",
        "property_type": "COMMERCIAL",
        "property_category": "TOKENIZED",
        "country": "United States",
        "state": "Punjab",
        "city": "Amritsar",
        "street_address": "450 Financial Way",
        "postal_code": "145001",
        "land_area": 45000.0,
        "area_unit": "SQ_FT",
        "valuation": 7000000.0,
        "creator_user_id": str(dup_seller_id),  # Duplicate older user UUID
        "current_owner_id": str(dup_seller_id),
        "status": "UNDER_REVIEW",
        "verification_status": "SUBMITTED",
        "created_at": now_dt,
        "updated_at": now_dt,
    }
    fake_db["documents"].docs[str(doc_2_id)] = {
        "_id": str(doc_2_id),
        "id": str(doc_2_id),
        "property_id": str(prop_2_id),
        "uploader_user_id": str(dup_seller_id),
        "document_type": "TITLE_DEED",
        "title": "Commercial Title Deed",
        "original_filename": "deed.pdf",
        "storage_path": "/remote/deed.pdf",
        "file_size": 2048,
        "mime_type": "application/pdf",
        "document_hash": "a" * 64,
        "is_encrypted": True,
        "version": 1,
        "status": "SUBMITTED_FOR_REVIEW",
        "created_at": now_dt,
        "updated_at": now_dt,
    }

    res_pull = mongo_mod.sync_from_mongo_if_stale(
        min_interval_seconds=0.0,
        mongo_db=fake_db,
        session_factory_override=SessionLocal,
    )
    assert res_pull["synced"] is True
    assert res_pull["inserted"] >= 2
    assert echo_events == []

    # Verify Commercial Center + its document landed with canonical owner + add local verification audit record
    with SessionLocal() as session:
        props = session.query(Property).all()
        assert len(props) == 2
        p2 = session.get(Property, prop_2_id)
        assert p2 is not None
        assert p2.title == "Commercial Center"
        assert p2.creator_user_id == canonical_seller_id
        assert p2.registration_date is None

        p1 = session.get(Property, prop_1_id)
        assert p1.registration_date == date(2026, 11, 10)

        ver_rec = DocumentVerificationRecord(
            id=uuid.uuid4(),
            document_id=doc_2_id,
            verifier_user_id=verifier_id,
            action="REVIEWING",
            comments="Local audit record must survive updates",
        )
        session.add(ver_rec)
        session.commit()
        ver_rec_id = ver_rec.id

    echo_events.clear()

    # 3) Unchanged pull uses digest fast-path
    res_unchanged = mongo_mod.sync_from_mongo_if_stale(
        min_interval_seconds=0.0,
        mongo_db=fake_db,
        session_factory_override=SessionLocal,
    )
    assert res_unchanged["reason"] == "unchanged"
    assert res_unchanged["changed"] == 0

    # 4) Update Commercial Center in MongoDB directly -> should update in-place & keep local DocumentVerificationRecord
    fake_db["properties"].docs[str(prop_2_id)]["verification_status"] = "VERIFIED"
    fake_db["properties"].docs[str(prop_2_id)]["status"] = "ACTIVE"
    fake_db["properties"].docs[str(prop_2_id)]["valuation"] = 7500000.0
    fake_db["documents"].docs[str(doc_2_id)]["status"] = "VERIFIED"

    res_update = mongo_mod.sync_from_mongo_if_stale(
        force=True,
        mongo_db=fake_db,
        session_factory_override=SessionLocal,
    )
    assert res_update["synced"] is True
    assert res_update["updated"] >= 2
    assert echo_events == []

    with SessionLocal() as session:
        p2 = session.get(Property, prop_2_id)
        d2 = session.get(PropertyDocument, doc_2_id)
        rec = session.get(DocumentVerificationRecord, ver_rec_id)
        assert p2.verification_status == "VERIFIED"
        assert p2.status == "ACTIVE"
        assert p2.valuation == Decimal("7500000")
        assert d2.status == "VERIFIED"
        assert rec is not None  # Non-replicated audit child preserved!

    # 5) Delete Commercial Center + doc from MongoDB directly -> should delete cleanly from SQLite on refresh
    del fake_db["documents"].docs[str(doc_2_id)]
    del fake_db["properties"].docs[str(prop_2_id)]

    res_del = mongo_mod.sync_from_mongo_if_stale(
        min_interval_seconds=0.0,
        mongo_db=fake_db,
        session_factory_override=SessionLocal,
    )
    assert res_del["synced"] is True
    assert res_del["deleted"] >= 2
    assert echo_events == []

    with SessionLocal() as session:
        assert session.get(Property, prop_2_id) is None
        assert session.get(PropertyDocument, doc_2_id) is None
        assert len(session.query(Property).all()) == 1


def test_objectid_property_and_failed_push_protection(isolated_sync_env):
    SessionLocal, fake_db = isolated_sync_env

    seller_id = uuid.uuid4()
    now_dt = datetime(2026, 11, 10, 4, 0, 0, tzinfo=timezone.utc)
    fake_db["users"].docs[str(seller_id)] = {
        "_id": str(seller_id),
        "id": str(seller_id),
        "full_name": "Seller",
        "email": "seller@propchain.network",
        "password_hash": "hash",
        "role": "PROPERTY_OWNER",
        "account_status": "ACTIVE",
        "email_verified": True,
        "created_at": now_dt,
        "updated_at": now_dt,
    }

    # Atlas UI / Compass ObjectId-style manual insert without UUID
    fake_db["properties"].docs["6730ab1234567890abcdef12"] = {
        "_id": "6730ab1234567890abcdef12",
        "property_number": "PROP-MANUAL-1",
        "title": "Atlas UI Inserted Villa",
        "property_type": "RESIDENTIAL",
        "state": "Maharashtra",
        "city": "Pune",
        "street_address": "10 Koregaon Park",
        "postal_code": "411001",
        "land_area": 3000.0,
        "creator_user_id": "seller@propchain.network",
    }

    # Local unpushed property whose Mongo push failed momentarily
    unpushed_id = uuid.uuid4()
    with SessionLocal() as session:
        session.add(
            User(
                id=seller_id,
                full_name="Seller",
                email="seller@propchain.network",
                password_hash="hash",
                role="PROPERTY_OWNER",
                account_status="ACTIVE",
                email_verified=True,
            )
        )
        session.add(
            Property(
                id=unpushed_id,
                property_number="PROP-LOCAL-UNPUSHED",
                title="Local Pending Push Villa",
                property_type="RESIDENTIAL",
                country="India",
                state="Goa",
                city="Panaji",
                street_address="1 Beach Rd",
                postal_code="403001",
                land_area=Decimal("2000"),
                creator_user_id=seller_id,
                current_owner_id=seller_id,
            )
        )
        session.commit()

    mongo_mod._mark_failed_push("properties", str(unpushed_id))

    res = mongo_mod.sync_from_mongo_if_stale(
        min_interval_seconds=0.0,
        mongo_db=fake_db,
        session_factory_override=SessionLocal,
    )
    assert res["synced"] is True
    assert res["inserted"] == 1

    with SessionLocal() as session:
        titles = {p.title for p in session.query(Property).all()}
        assert "Atlas UI Inserted Villa" in titles
        assert "Local Pending Push Villa" in titles  # Protected from deletion!
