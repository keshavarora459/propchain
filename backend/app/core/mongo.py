"""
MongoDB Atlas Storage and Dual-State Sync Engine for PropChain.
Manages persistent document storage in MongoDB Atlas cluster with real-time entity replication.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from decimal import Decimal
import hashlib
import json
import threading
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

try:
    import pymongo
    HAS_PYMONGO = True
except ImportError:
    pymongo = None
    HAS_PYMONGO = False
if HAS_PYMONGO:
    from pymongo import MongoClient
else:
    MongoClient = Any
if HAS_PYMONGO:
    from pymongo.database import Database
else:
    Database = Any
from sqlalchemy import Boolean, Date, DateTime, Integer, JSON, Numeric, Uuid, event, inspect
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("core.mongo")

_mongo_client: Optional[MongoClient] = None
_mongo_db: Optional[Database] = None
_mongo_available: Optional[bool] = None
_mongo_unavailable_since: float = 0.0
_mongo_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="mongo_sync")
_mongo_pull_lock = threading.RLock()
_last_mongo_pull_ts: float = 0.0
_last_mongo_snapshot_digests: Dict[Tuple[int, int], str] = {}
_DEFAULT_SYNC_INTERVAL_SECONDS: float = 1.5
_MONGO_RETRY_COOLDOWN_SECONDS: float = 30.0
_failed_push_lock = threading.Lock()
_failed_push_ids: Set[Tuple[str, str]] = set()

# Mapping SQLAlchemy model class names to MongoDB collections
COLLECTION_MAPPING = {
    "Property": "properties",
    "User": "users",
    "PropertyDocument": "documents",
    "PropertyTransaction": "transactions",
    "TransactionApproval": "approvals",
    "OwnershipEvent": "ownership_events",
    "UserWallet": "wallets",
    "BlockchainEvent": "blockchain_events",
    "BlockchainOperation": "blockchain_operations",
    "AuditLog": "audit_logs",
    "UserActivityLog": "user_activity_logs",
    "Notification": "notifications",
    "LoginAttempt": "login_attempts",
    "RefreshToken": "refresh_tokens",
}


def get_mongo_client() -> Optional[MongoClient]:
    """Obtain or initialize the singleton MongoClient."""
    global _mongo_client, _mongo_available, _mongo_unavailable_since
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        return None
    if not HAS_PYMONGO:
        return None
    if _mongo_available is False:
        if (time.monotonic() - _mongo_unavailable_since) < _MONGO_RETRY_COOLDOWN_SECONDS:
            return None
        _mongo_available = None

    if _mongo_client is None:
        uri = settings.MONGODB_URI
        if not uri:
            logger.warning("No MONGODB_URI configured in environment.")
            return None

        logger.info("Initializing MongoDB client...")
        try:
            import certifi
            ca_file = certifi.where()
        except Exception:
            ca_file = None

        try:
            import dns.resolver
            resolver = dns.resolver.get_default_resolver()
            resolver.timeout = 2.0
            resolver.lifetime = 8.0
            for ns in ("8.8.8.8", "1.1.1.1"):
                if ns not in resolver.nameservers:
                    resolver.nameservers.append(ns)
        except Exception:
            pass

        client_kwargs = {
            "serverSelectionTimeoutMS": 10000,
            "connectTimeoutMS": 10000,
            "socketTimeoutMS": 15000,
            "maxPoolSize": 20,
            "tls": True,
            "tlsAllowInvalidCertificates": True,
        }
        if ca_file:
            client_kwargs["tlsCAFile"] = ca_file

        try:
            _mongo_client = MongoClient(uri, **client_kwargs)
        except Exception as dns_exc:
            logger.warning("Initial MongoDB SRV lookup notice (%s), retrying with public DNS...", dns_exc)
            try:
                import dns.resolver
                dns.resolver.get_default_resolver().nameservers = ["8.8.8.8", "1.1.1.1"]
                _mongo_client = MongoClient(uri, **client_kwargs)
            except Exception:
                raise dns_exc
    return _mongo_client


def get_mongo_db() -> Optional[Database]:
    """Obtain the configured MongoDB database."""
    global _mongo_db
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        return None
    if not HAS_PYMONGO:
        return None

    if _mongo_db is None:
        client = get_mongo_client()
        if client is None:
            return None
        _mongo_db = client[settings.MONGODB_DB_NAME]
    return _mongo_db


def close_mongo_client() -> None:
    """Safely terminate MongoDB connection pool."""
    global _mongo_client, _mongo_db
    if _mongo_client is not None:
        try:
            _mongo_client.close()
            logger.info("MongoDB client disconnected cleanly.")
        except Exception as exc:
            logger.warning("Error while closing MongoDB client: %s", exc)
        finally:
            _mongo_client = None
            _mongo_db = None


def check_mongo_connection() -> Tuple[bool, str, Dict[str, Any]]:
    """Verify MongoDB connectivity and return current cluster telemetry."""
    global _mongo_available, _mongo_unavailable_since
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        _mongo_available = False
        _mongo_unavailable_since = time.monotonic()
        return False, "MongoDB disabled in test environment", {}
    if not HAS_PYMONGO:
        _mongo_available = False
        _mongo_unavailable_since = time.monotonic()
        return False, "pymongo package is not installed", {}
    try:
        _mongo_available = None
        client = get_mongo_client()
        if client is None:
            _mongo_available = False
            _mongo_unavailable_since = time.monotonic()
            return False, "MongoDB client could not be initialized", {}
        info = client.server_info()
        db = get_mongo_db()
        if db is None:
            _mongo_available = False
            _mongo_unavailable_since = time.monotonic()
            return False, "MongoDB database unavailable", {}
        collections = db.list_collection_names()
        stats = {col: db[col].count_documents({}) for col in collections}
        _mongo_available = True
        _mongo_unavailable_since = 0.0
        return True, f"MongoDB Connected (v{info.get('version', 'unknown')})", {
            "collections": collections,
            "counts": stats,
            "cluster_database": db.name,
        }
    except Exception as exc:
        _mongo_available = False
        _mongo_unavailable_since = time.monotonic()
        logger.warning("MongoDB health check failed: %s", exc)
        return False, str(exc), {}


def serialize_entity_for_mongo(entity: Any) -> Dict[str, Any]:
    """Convert an ORM entity into a clean, MongoDB-compatible dictionary."""
    data: Dict[str, Any] = {}

    if hasattr(entity, "to_dict") and callable(entity.to_dict):
        raw_dict = entity.to_dict()
    else:
        mapper = inspect(entity.__class__)
        raw_dict = {col.key: getattr(entity, col.key) for col in mapper.attrs if hasattr(col, "key")}

    for k, v in raw_dict.items():
        if isinstance(v, uuid.UUID):
            data[k] = str(v)
        elif isinstance(v, Decimal):
            data[k] = float(v)
        elif isinstance(v, datetime):
            data[k] = v
        elif isinstance(v, date):
            data[k] = datetime(v.year, v.month, v.day, tzinfo=timezone.utc)
        elif isinstance(v, (list, tuple)):
            data[k] = [
                str(item) if isinstance(item, (uuid.UUID, Decimal)) else item
                for item in v
            ]
        elif isinstance(v, dict):
            data[k] = {
                dk: str(dv) if isinstance(dv, (uuid.UUID, Decimal)) else dv
                for dk, dv in v.items()
            }
        else:
            data[k] = v

    # Guarantee _id string matches primary key
    if hasattr(entity, "id") and entity.id is not None:
        data["_id"] = str(entity.id)
    elif "id" in data and data["id"] is not None:
        data["_id"] = str(data["id"])

    data["_synced_to_mongo_at"] = datetime.now(timezone.utc)
    return data


def sync_entity_to_mongo(entity: Any) -> None:
    """Upsert a single entity into its corresponding MongoDB collection."""
    model_name = entity.__class__.__name__
    collection_name = COLLECTION_MAPPING.get(model_name)
    if not collection_name:
        return

    try:
        db = get_mongo_db()
        if db is None:
            return
        doc = serialize_entity_for_mongo(entity)
        if "_id" in doc:
            db[collection_name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
            logger.debug("Synced %s [%s] to MongoDB collection '%s'", model_name, doc["_id"], collection_name)
    except Exception as exc:
        logger.warning("Failed to sync %s to MongoDB: %s", model_name, exc)


def delete_entity_from_mongo(entity: Any) -> None:
    """Remove a deleted entity from MongoDB collection."""
    model_name = entity.__class__.__name__
    collection_name = COLLECTION_MAPPING.get(model_name)
    if not collection_name:
        return

    try:
        entity_id = str(getattr(entity, "id", None))
        if entity_id:
            db = get_mongo_db()
            if db is None:
                return
            db[collection_name].delete_one({"_id": entity_id})
            logger.debug("Deleted %s [%s] from MongoDB collection '%s'", model_name, entity_id, collection_name)
    except Exception as exc:
        logger.warning("Failed to delete %s [%s] from MongoDB: %s", model_name, getattr(entity, "id", None), exc)


def sync_all_to_mongo(session: Session) -> Dict[str, int]:
    """Perform a complete sync of all existing entities from database to MongoDB."""
    logger.info("Executing comprehensive database -> MongoDB initial synchronization...")
    results: Dict[str, int] = {}
    db = get_mongo_db()
    if db is None:
        return results

    # Import models here to prevent circular dependency
    from app.models.approval import TransactionApproval
    from app.models.blockchain import BlockchainEvent, OwnershipEvent
    from app.models.document import PropertyDocument
    from app.models.property import Property
    from app.models.transaction import PropertyTransaction
    from app.models.user import User
    from app.models.wallet import UserWallet

    models_to_sync = [
        ("users", User),
        ("properties", Property),
        ("documents", PropertyDocument),
        ("transactions", PropertyTransaction),
        ("approvals", TransactionApproval),
        ("ownership_events", OwnershipEvent),
        ("wallets", UserWallet),
        ("blockchain_events", BlockchainEvent),
    ]

    for col_name, model_cls in models_to_sync:
        try:
            records = session.query(model_cls).all()
            count = 0
            for record in records:
                doc = serialize_entity_for_mongo(record)
                if "_id" in doc:
                    db[col_name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                    count += 1
            results[col_name] = count
            logger.info("MongoDB Sync: %d %s saved to collection '%s'", count, model_cls.__name__, col_name)
        except Exception as exc:
            logger.warning("Could not sync %s to MongoDB: %s", model_cls.__name__, exc)
            results[col_name] = 0

    return results


def _mark_failed_push(col_name: str, entity_id: str) -> None:
    if not col_name or not entity_id:
        return
    with _failed_push_lock:
        _failed_push_ids.add((col_name, entity_id))


def _clear_failed_push(col_name: str, entity_id: str) -> None:
    if not col_name or not entity_id:
        return
    with _failed_push_lock:
        _failed_push_ids.discard((col_name, entity_id))


def _snapshot_failed_pushes() -> Set[Tuple[str, str]]:
    with _failed_push_lock:
        return set(_failed_push_ids)


# SQLAlchemy Automatic Event Hook
def setup_sqlalchemy_mongo_listener() -> None:
    """Register event hooks on SQLAlchemy Session to replicate changes to MongoDB in real time."""
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        return
    if not HAS_PYMONGO:
        return

    @event.listens_for(Session, "after_flush")
    def receive_after_flush(session: Session, flush_context: Any) -> None:
        """Capture all new, modified, and deleted entities and replicate to MongoDB."""
        if session.info.get("_skip_mongo_replication"):
            return

        new_items = []
        for inst in list(session.new):
            m_name = inst.__class__.__name__
            if m_name in COLLECTION_MAPPING:
                try:
                    new_items.append((m_name, serialize_entity_for_mongo(inst)))
                except Exception:
                    pass

        dirty_items = []
        for inst in list(session.dirty):
            m_name = inst.__class__.__name__
            if m_name in COLLECTION_MAPPING:
                try:
                    dirty_items.append((m_name, serialize_entity_for_mongo(inst)))
                except Exception:
                    pass

        del_items = []
        for inst in list(session.deleted):
            m_name = inst.__class__.__name__
            if m_name in COLLECTION_MAPPING:
                try:
                    del_items.append((m_name, str(getattr(inst, "id", ""))))
                except Exception:
                    pass

        def _replicate():
            db = get_mongo_db()
            if db is None:
                for model_name, doc in new_items + dirty_items:
                    col_name = COLLECTION_MAPPING.get(model_name)
                    if col_name and doc.get("_id"):
                        _mark_failed_push(col_name, doc["_id"])
                return
            for model_name, doc in new_items + dirty_items:
                col_name = COLLECTION_MAPPING.get(model_name)
                if col_name and "_id" in doc:
                    try:
                        db[col_name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                        _clear_failed_push(col_name, doc["_id"])
                    except Exception as e:
                        _mark_failed_push(col_name, doc["_id"])
                        logger.debug("Mongo sync notice for %s: %s", model_name, e)
            for model_name, ent_id in del_items:
                col_name = COLLECTION_MAPPING.get(model_name)
                if col_name and ent_id:
                    try:
                        db[col_name].delete_one({"_id": ent_id})
                        _clear_failed_push(col_name, ent_id)
                    except Exception as e:
                        logger.debug("Mongo delete notice for %s: %s", model_name, e)

        if new_items or dirty_items or del_items:
            try:
                _replicate()
            except Exception as e:
                logger.warning("Synchronous MongoDB replication notice: %s", e)

    logger.info("Registered SQLAlchemy real-time MongoDB asynchronous replication listener.")


def safe_uuid(val: Any) -> Optional[uuid.UUID]:
    """Safely convert any value to UUID, returning None if invalid or empty."""
    if not val:
        return None

    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return None


def _extract_entity_uuid(col_name: str, doc: Dict[str, Any]) -> Optional[uuid.UUID]:
    """Resolve an entity UUID from Mongo _id/id, with deterministic UUID5 fallback for ObjectIds."""
    uid = safe_uuid(doc.get("id")) or safe_uuid(doc.get("_id"))
    if uid is not None:
        return uid
    raw_id = doc.get("_id") or doc.get("id")
    if raw_id is None:
        return None
    raw_str = str(raw_id).strip()
    if not raw_str:
        return None
    return uuid.uuid5(uuid.NAMESPACE_OID, f"{col_name}:{raw_str}")


def _coerce_datetime(val: Any) -> Optional[datetime]:
    """Normalize BSON datetimes, dates, or ISO strings into timezone-aware UTC datetimes."""
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val.astimezone(timezone.utc)
    if isinstance(val, date):
        return datetime(val.year, val.month, val.day, tzinfo=timezone.utc)
    if isinstance(val, str):
        text_val = val.strip()
        if not text_val:
            return None
        try:
            dt = datetime.fromisoformat(text_val.replace("Z", "+00:00"))
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def _coerce_date(val: Any) -> Optional[date]:
    """Normalize datetimes, dates, or ISO date strings into Python date objects."""
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        text_val = val.strip()
        if not text_val:
            return None
        try:
            return date.fromisoformat(text_val[:10])
        except ValueError:
            dt = _coerce_datetime(text_val)
            return dt.date() if dt else None
    return None


def _coerce_column_value(col: Any, val: Any) -> Any:
    """Coerce a MongoDB field value into the Python type expected by a SQLAlchemy column."""
    if val is None:
        return None
    col_type = col.type
    if isinstance(col_type, Uuid):
        return safe_uuid(val)
    if isinstance(col_type, DateTime):
        return _coerce_datetime(val)
    if isinstance(col_type, Date):
        return _coerce_date(val)
    if isinstance(col_type, Numeric):
        if hasattr(val, "to_decimal"):
            return val.to_decimal()
        try:
            return Decimal(str(val))
        except Exception:
            return None
    if isinstance(col_type, Integer):
        if isinstance(val, bool):
            return int(val)
        try:
            return int(val)
        except Exception:
            return None
    if isinstance(col_type, Boolean):
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.strip().lower() in {"true", "1", "yes", "y"}
        return bool(val)
    if isinstance(col_type, JSON):
        if isinstance(val, (dict, list)):
            return val
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return {}
        return val
    return val if isinstance(val, str) else str(val)


def _values_equal(col: Any, current_val: Any, new_val: Any) -> bool:
    """Compare existing ORM field values with incoming Mongo values cleanly."""
    if current_val is None and new_val is None:
        return True
    if current_val is None or new_val is None:
        return False
    col_type = col.type
    if isinstance(col_type, DateTime):
        dt_a = _coerce_datetime(current_val)
        dt_b = _coerce_datetime(new_val)
        if dt_a is None or dt_b is None:
            return dt_a is dt_b
        return int(dt_a.timestamp() * 1000) == int(dt_b.timestamp() * 1000)
    if isinstance(col_type, Date):
        return _coerce_date(current_val) == _coerce_date(new_val)
    if isinstance(col_type, Numeric):
        try:
            return abs(Decimal(str(current_val)) - Decimal(str(new_val))) < Decimal("1e-8")
        except Exception:
            return current_val == new_val
    if isinstance(col_type, Uuid):
        return safe_uuid(current_val) == safe_uuid(new_val)
    return current_val == new_val


def _prepare_column_data(model_cls: Any, raw_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Extract and coerce known table columns from a raw MongoDB document."""
    prepared: Dict[str, Any] = {}
    for col in model_cls.__table__.columns:
        if col.name in raw_doc:
            prepared[col.name] = _coerce_column_value(col, raw_doc[col.name])
    return prepared


def _upsert_entity(
    session: Session,
    model_cls: Any,
    entity_id: uuid.UUID,
    prepared: Dict[str, Any],
    local_by_id: Dict[uuid.UUID, Any],
    skip_update_cols: Optional[Set[str]] = None,
) -> str:
    """Insert or update a single ORM entity inside a savepoint. Returns inserted/updated/unchanged/error."""
    existing = local_by_id.get(entity_id)
    if existing is not None:
        dirty = False
        skip_cols = skip_update_cols or set()
        for col in model_cls.__table__.columns:
            if col.name == "id" or col.name in skip_cols or col.name not in prepared:
                continue
            new_val = prepared[col.name]
            if new_val is None and not col.nullable:
                continue
            cur_val = getattr(existing, col.name)
            if not _values_equal(col, cur_val, new_val):
                setattr(existing, col.name, new_val)
                dirty = True
        if not dirty:
            return "unchanged"
        try:
            with session.begin_nested():
                session.flush()
            return "updated"
        except Exception as exc:
            logger.warning("Could not update %s [%s] from MongoDB: %s", model_cls.__name__, entity_id, exc)
            return "error"

    insert_kwargs: Dict[str, Any] = {"id": entity_id}
    for col in model_cls.__table__.columns:
        if col.name == "id" or col.name not in prepared:
            continue
        val = prepared[col.name]
        if val is None and not col.nullable:
            continue
        insert_kwargs[col.name] = val

    try:
        with session.begin_nested():
            obj = model_cls(**insert_kwargs)
            session.add(obj)
            session.flush()
        local_by_id[entity_id] = obj
        return "inserted"
    except Exception as exc:
        logger.warning("Could not insert %s [%s] from MongoDB: %s", model_cls.__name__, entity_id, exc)
        return "error"


_SYNC_COLLECTION_NAMES = (
    "users",
    "properties",
    "documents",
    "transactions",
    "approvals",
    "notifications",
    "ownership_events",
    "wallets",
    "blockchain_events",
    "blockchain_operations",
)


def _fetch_mongo_collections(db: Database) -> Dict[str, Optional[List[Dict[str, Any]]]]:
    """Fetch collection snapshots from MongoDB outside any active SQLite write transaction."""
    snapshots: Dict[str, Optional[List[Dict[str, Any]]]] = {}
    for col_name in _SYNC_COLLECTION_NAMES:
        try:
            cursor = db[col_name].find()
            if col_name == "users":
                cursor = cursor.sort([("updated_at", -1), ("created_at", -1)])
            snapshots[col_name] = list(cursor)
        except Exception as exc:
            logger.warning("Failed fetching MongoDB collection '%s': %s", col_name, exc)
            snapshots[col_name] = None
    return snapshots


def _reconcile_from_mongo_session(
    session: Session,
    db: Database,
    clear_existing: bool = False,
    prefetched: Optional[Dict[str, Optional[List[Dict[str, Any]]]]] = None,
) -> Dict[str, Any]:
    """Reconcile in-memory SQLite tables against MongoDB Atlas safely without echo writes."""
    from app.models.approval import TransactionApproval
    from app.models.blockchain import BlockchainEvent, BlockchainOperation, OwnershipEvent
    from app.models.document import PropertyDocument
    from app.models.notification import Notification
    from app.models.property import Property
    from app.models.transaction import PropertyTransaction
    from app.models.user import User
    from app.models.wallet import UserWallet

    prev_skip = session.info.get("_skip_mongo_replication", False)
    session.info["_skip_mongo_replication"] = True

    summary: Dict[str, Any] = {
        "users": 0,
        "properties": 0,
        "documents": 0,
        "transactions": 0,
        "approvals": 0,
        "notifications": 0,
        "ownership_events": 0,
        "wallets": 0,
        "blockchain_events": 0,
        "blockchain_operations": 0,
        "deleted": 0,
        "updated": 0,
        "inserted": 0,
        "changed": 0,
    }

    try:
        if clear_existing:
            try:
                session.query(TransactionApproval).delete()
                session.query(PropertyTransaction).delete()
                session.query(PropertyDocument).delete()
                session.query(Property).delete()
                session.query(OwnershipEvent).delete()
                session.query(BlockchainEvent).delete()
                session.query(BlockchainOperation).delete()
                session.query(Notification).delete()
                session.query(UserWallet).delete()
                session.commit()
            except Exception as exc:
                session.rollback()
                logger.warning("Error clearing tables during resync: %s", exc)

        snapshots = prefetched if prefetched is not None else _fetch_mongo_collections(db)
        failed_pushes = _snapshot_failed_pushes()

        # 1. Users (deduplicate by email, preserving canonical user IDs and aliasing duplicates)
        local_users = session.query(User).all()
        local_users_by_id: Dict[uuid.UUID, User] = {u.id: u for u in local_users}
        local_users_by_email: Dict[str, User] = {
            str(u.email).lower().strip(): u for u in local_users if u.email
        }
        mongo_uid_to_canonical: Dict[uuid.UUID, uuid.UUID] = {}
        admin_fallback_id: Optional[uuid.UUID] = next(
            (u.id for u in local_users if u.role == "ADMIN"),
            None,
        )

        user_docs = snapshots.get("users")
        if user_docs is not None:
            for u_doc in user_docs:
                u_id = _extract_entity_uuid("users", u_doc)
                if not u_id:
                    continue
                email = str(u_doc.get("email", "")).lower().strip()
                if not email:
                    continue

                if u_id in local_users_by_id:
                    target_user = local_users_by_id[u_id]
                    mongo_uid_to_canonical[u_id] = target_user.id
                    prepared = _prepare_column_data(User, u_doc)
                    prepared["email"] = email
                    if prepared.get("role") == "VERIFIER":
                        prepared["role"] = "REGISTRAR"
                    # Avoid email unique conflict if email differs from existing row
                    email_owner = local_users_by_email.get(email)
                    skip_cols = {"email"} if (email_owner and email_owner.id != u_id) else set()
                    res = _upsert_entity(session, User, u_id, prepared, local_users_by_id, skip_update_cols=skip_cols)
                    if res == "updated":
                        summary["updated"] += 1
                        summary["changed"] += 1
                elif email in local_users_by_email:
                    mongo_uid_to_canonical[u_id] = local_users_by_email[email].id
                else:
                    prepared = _prepare_column_data(User, u_doc)
                    prepared["email"] = email
                    if prepared.get("role") == "VERIFIER":
                        prepared["role"] = "REGISTRAR"
                    res = _upsert_entity(session, User, u_id, prepared, local_users_by_id)
                    if res == "inserted":
                        local_users_by_email[email] = local_users_by_id[u_id]
                        mongo_uid_to_canonical[u_id] = u_id
                        if prepared.get("role") == "ADMIN" and not admin_fallback_id:
                            admin_fallback_id = u_id
                        summary["users"] += 1
                        summary["inserted"] += 1
                        summary["changed"] += 1

        all_valid_user_ids: Set[uuid.UUID] = set(local_users_by_id.keys())
        default_user_id = admin_fallback_id or (next(iter(all_valid_user_ids)) if all_valid_user_ids else None)

        def _resolve_user_id(
            raw_val: Any,
            *,
            allow_none: bool = False,
            fallback: Optional[uuid.UUID] = default_user_id,
        ) -> Optional[uuid.UUID]:
            if isinstance(raw_val, str) and "@" in raw_val:
                u_by_email = local_users_by_email.get(raw_val.lower().strip())
                if u_by_email:
                    return u_by_email.id
            uid = safe_uuid(raw_val)
            if uid in mongo_uid_to_canonical:
                return mongo_uid_to_canonical[uid]
            if uid in all_valid_user_ids:
                return uid
            return None if allow_none else fallback

        # Build UUID sets for collections that were cleanly fetched from MongoDB
        mongo_ids_by_col: Dict[str, Set[uuid.UUID]] = {}
        for col_name in (
            "properties",
            "documents",
            "transactions",
            "approvals",
            "notifications",
            "ownership_events",
            "wallets",
            "blockchain_events",
            "blockchain_operations",
        ):
            docs = snapshots.get(col_name)
            if docs is not None:
                id_set: Set[uuid.UUID] = set()
                for doc in docs:
                    eid = _extract_entity_uuid(col_name, doc)
                    if eid is not None:
                        id_set.add(eid)
                mongo_ids_by_col[col_name] = id_set

        # 2. Reconcile deletions in reverse FK dependency order (only on live incremental sync)
        if not clear_existing:
            local_txs_remaining: Set[uuid.UUID] = set()
            protected_prop_ids: Set[uuid.UUID] = set()

            deletion_plan: List[Tuple[str, Any]] = [
                ("approvals", TransactionApproval),
                ("transactions", PropertyTransaction),
                ("documents", PropertyDocument),
                ("ownership_events", OwnershipEvent),
                ("properties", Property),
                ("notifications", Notification),
                ("wallets", UserWallet),
                ("blockchain_events", BlockchainEvent),
                ("blockchain_operations", BlockchainOperation),
            ]
            for col_name, model_cls in deletion_plan:
                if col_name not in mongo_ids_by_col:
                    continue
                valid_mongo_ids = mongo_ids_by_col[col_name]
                for obj in session.query(model_cls).all():
                    str_id = str(obj.id)
                    if obj.id in valid_mongo_ids:
                        if col_name == "transactions":
                            local_txs_remaining.add(obj.id)
                            protected_prop_ids.add(obj.property_id)
                        continue
                    if (col_name, str_id) in failed_pushes:
                        if col_name == "transactions":
                            local_txs_remaining.add(obj.id)
                            protected_prop_ids.add(obj.property_id)
                        continue
                    if col_name == "properties" and obj.id in protected_prop_ids:
                        continue
                    try:
                        with session.begin_nested():
                            session.delete(obj)
                            session.flush()
                        summary["deleted"] += 1
                        summary["changed"] += 1
                    except Exception as exc:
                        logger.warning("Could not remove deleted %s [%s]: %s", model_cls.__name__, str_id, exc)

        # 3. Properties
        local_props = {p.id: p for p in session.query(Property).all()}
        local_props_by_number = {p.property_number: p for p in local_props.values() if p.property_number}
        prop_docs = snapshots.get("properties")
        if prop_docs is not None:
            for p_doc in prop_docs:
                p_id = _extract_entity_uuid("properties", p_doc)
                if not p_id:
                    continue
                prepared = _prepare_column_data(Property, p_doc)
                if not prepared.get("property_number"):
                    prepared["property_number"] = f"PROP-{str(p_id)[:8].upper()}"

                # Guard against property_number conflict on distinct IDs
                existing_num_owner = local_props_by_number.get(prepared["property_number"])
                if existing_num_owner and existing_num_owner.id != p_id:
                    continue

                c_id = _resolve_user_id(p_doc.get("creator_user_id"))
                if not c_id:
                    continue
                o_id = _resolve_user_id(p_doc.get("current_owner_id"), allow_none=True) or c_id
                v_id = _resolve_user_id(p_doc.get("verified_by_id"), allow_none=True)
                prepared["creator_user_id"] = c_id
                prepared["current_owner_id"] = o_id
                prepared["verified_by_id"] = v_id

                res = _upsert_entity(session, Property, p_id, prepared, local_props)
                if res == "inserted":
                    local_props_by_number[prepared["property_number"]] = local_props[p_id]
                    summary["properties"] += 1
                    summary["inserted"] += 1
                    summary["changed"] += 1
                elif res == "updated":
                    local_props_by_number[local_props[p_id].property_number] = local_props[p_id]
                    summary["properties"] += 1
                    summary["updated"] += 1
                    summary["changed"] += 1
                elif not clear_existing:
                    # Keep count consistent for startup stats when already matching
                    pass

        valid_prop_ids: Set[uuid.UUID] = set(local_props.keys())

        def _resolve_property_id(raw_val: Any) -> Optional[uuid.UUID]:
            pid = safe_uuid(raw_val)
            if pid and pid in valid_prop_ids:
                return pid
            if raw_val:
                p_by_num = local_props_by_number.get(str(raw_val).strip())
                if p_by_num:
                    return p_by_num.id
            return None

        # 4. Documents
        local_docs = {d.id: d for d in session.query(PropertyDocument).all()}
        doc_rows = snapshots.get("documents")
        if doc_rows is not None:
            for d_doc in doc_rows:
                d_id = _extract_entity_uuid("documents", d_doc)
                if not d_id:
                    continue
                p_id = _resolve_property_id(d_doc.get("property_id"))
                if not p_id:
                    continue
                u_id = _resolve_user_id(d_doc.get("uploader_user_id"))
                if not u_id:
                    continue
                prepared = _prepare_column_data(PropertyDocument, d_doc)
                prepared["property_id"] = p_id
                prepared["uploader_user_id"] = u_id

                res = _upsert_entity(session, PropertyDocument, d_id, prepared, local_docs)
                if res in ("inserted", "updated"):
                    summary["documents"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        # 5. Transactions
        local_txs = {t.id: t for t in session.query(PropertyTransaction).all()}
        local_txs_by_number = {t.transaction_number: t for t in local_txs.values() if t.transaction_number}
        tx_rows = snapshots.get("transactions")
        if tx_rows is not None:
            for t_doc in tx_rows:
                t_id = _extract_entity_uuid("transactions", t_doc)
                if not t_id:
                    continue
                p_id = _resolve_property_id(t_doc.get("property_id"))
                if not p_id:
                    continue
                b_id = _resolve_user_id(t_doc.get("buyer_id") or t_doc.get("buyer_user_id"))
                s_id = _resolve_user_id(t_doc.get("seller_id") or t_doc.get("seller_user_id"))
                if not b_id or not s_id:
                    continue
                prepared = _prepare_column_data(PropertyTransaction, t_doc)
                if not prepared.get("transaction_number"):
                    prepared["transaction_number"] = f"TXN-{str(t_id)[:8].upper()}"
                existing_tx_num = local_txs_by_number.get(prepared["transaction_number"])
                if existing_tx_num and existing_tx_num.id != t_id:
                    continue
                prepared["property_id"] = p_id
                prepared["buyer_id"] = b_id
                prepared["seller_id"] = s_id

                res = _upsert_entity(session, PropertyTransaction, t_id, prepared, local_txs)
                if res in ("inserted", "updated"):
                    local_txs_by_number[local_txs[t_id].transaction_number] = local_txs[t_id]
                    summary["transactions"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        valid_tx_ids: Set[uuid.UUID] = set(local_txs.keys())

        # 6. Approvals
        local_approvals = {a.id: a for a in session.query(TransactionApproval).all()}
        appr_rows = snapshots.get("approvals")
        if appr_rows is not None:
            for a_doc in appr_rows:
                a_id = _extract_entity_uuid("approvals", a_doc)
                if not a_id:
                    continue
                tx_id = safe_uuid(a_doc.get("transaction_id"))
                if not tx_id or tx_id not in valid_tx_ids:
                    continue
                ap_id = _resolve_user_id(a_doc.get("approver_user_id"), allow_none=True)
                prepared = _prepare_column_data(TransactionApproval, a_doc)
                prepared["transaction_id"] = tx_id
                prepared["approver_user_id"] = ap_id

                res = _upsert_entity(session, TransactionApproval, a_id, prepared, local_approvals)
                if res in ("inserted", "updated"):
                    summary["approvals"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        # 7. Notifications
        local_notifications = {n.id: n for n in session.query(Notification).all()}
        notif_rows = snapshots.get("notifications")
        if notif_rows is not None:
            for n_doc in notif_rows:
                n_id = _extract_entity_uuid("notifications", n_doc)
                if not n_id:
                    continue
                u_id = _resolve_user_id(n_doc.get("user_id"), allow_none=True)
                if not u_id:
                    continue
                prepared = _prepare_column_data(Notification, n_doc)
                prepared["user_id"] = u_id

                res = _upsert_entity(session, Notification, n_id, prepared, local_notifications)
                if res in ("inserted", "updated"):
                    summary["notifications"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        # 8. Ownership Events
        local_own_events = {o.id: o for o in session.query(OwnershipEvent).all()}
        own_rows = snapshots.get("ownership_events")
        if own_rows is not None:
            for o_doc in own_rows:
                o_id = _extract_entity_uuid("ownership_events", o_doc)
                if not o_id:
                    continue
                p_id = _resolve_property_id(o_doc.get("property_id"))
                if not p_id:
                    continue
                new_owner = _resolve_user_id(o_doc.get("new_owner_id"))
                if not new_owner:
                    continue
                prev_owner = _resolve_user_id(o_doc.get("previous_owner_id"), allow_none=True)
                prepared = _prepare_column_data(OwnershipEvent, o_doc)
                prepared["property_id"] = p_id
                prepared["new_owner_id"] = new_owner
                prepared["previous_owner_id"] = prev_owner
                if prepared.get("transaction_id") is not None:
                    prepared["transaction_id"] = str(prepared["transaction_id"])

                res = _upsert_entity(session, OwnershipEvent, o_id, prepared, local_own_events)
                if res in ("inserted", "updated"):
                    summary["ownership_events"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        # 9. Wallets
        local_wallets = {w.id: w for w in session.query(UserWallet).all()}
        local_wallet_keys = {
            (w.user_id, str(w.wallet_address).lower()): w.id
            for w in local_wallets.values()
            if w.wallet_address
        }
        wallet_rows = snapshots.get("wallets")
        if wallet_rows is not None:
            for w_doc in wallet_rows:
                w_id = _extract_entity_uuid("wallets", w_doc)
                if not w_id:
                    continue
                u_id = _resolve_user_id(w_doc.get("user_id"), allow_none=True)
                if not u_id:
                    continue
                prepared = _prepare_column_data(UserWallet, w_doc)
                prepared["user_id"] = u_id
                w_addr = str(prepared.get("wallet_address") or "").lower()
                if not w_addr:
                    continue
                existing_pair_id = local_wallet_keys.get((u_id, w_addr))
                if existing_pair_id and existing_pair_id != w_id:
                    continue

                res = _upsert_entity(session, UserWallet, w_id, prepared, local_wallets)
                if res in ("inserted", "updated"):
                    local_wallet_keys[(u_id, str(local_wallets[w_id].wallet_address).lower())] = w_id
                    summary["wallets"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        # 10. Blockchain Events
        local_bc_events = {e.id: e for e in session.query(BlockchainEvent).all()}
        bc_event_rows = snapshots.get("blockchain_events")
        if bc_event_rows is not None:
            for e_doc in bc_event_rows:
                e_id = _extract_entity_uuid("blockchain_events", e_doc)
                if not e_id:
                    continue
                prepared = _prepare_column_data(BlockchainEvent, e_doc)
                res = _upsert_entity(session, BlockchainEvent, e_id, prepared, local_bc_events)
                if res in ("inserted", "updated"):
                    summary["blockchain_events"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        # 11. Blockchain Operations
        local_bc_ops = {op.id: op for op in session.query(BlockchainOperation).all()}
        bc_op_rows = snapshots.get("blockchain_operations")
        if bc_op_rows is not None:
            for op_doc in bc_op_rows:
                op_id = _extract_entity_uuid("blockchain_operations", op_doc)
                if not op_id:
                    continue
                prepared = _prepare_column_data(BlockchainOperation, op_doc)
                res = _upsert_entity(session, BlockchainOperation, op_id, prepared, local_bc_ops)
                if res in ("inserted", "updated"):
                    summary["blockchain_operations"] += 1
                    summary[res] += 1
                    summary["changed"] += 1

        return summary
    finally:
        session.info["_skip_mongo_replication"] = prev_skip


def _normalize_for_digest(val: Any) -> Any:
    """Normalize BSON/Python values into a deterministic JSON-serializable shape for diff hashing."""
    if val is None or isinstance(val, (bool, int, str)):
        return val
    if isinstance(val, float):
        return round(val, 8)
    if isinstance(val, Decimal):
        return round(float(val), 8)
    if hasattr(val, "to_decimal"):
        try:
            return round(float(val.to_decimal()), 8)
        except Exception:
            return str(val)
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, datetime):
        dt = val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val.astimezone(timezone.utc)
        return int(dt.timestamp() * 1000)
    if isinstance(val, date):
        return val.isoformat()
    if isinstance(val, dict):
        return {
            str(k): _normalize_for_digest(v)
            for k, v in sorted(val.items(), key=lambda kv: str(kv[0]))
            if k != "_synced_to_mongo_at"
        }
    if isinstance(val, (list, tuple)):
        return [_normalize_for_digest(v) for v in val]
    return str(val)


def _compute_snapshots_digest(snapshots: Dict[str, Optional[List[Dict[str, Any]]]]) -> Optional[str]:
    """Compute a SHA-256 digest of complete fetched Mongo collections; returns None if any collection failed."""
    payload: Dict[str, List[Any]] = {}
    for col_name in _SYNC_COLLECTION_NAMES:
        docs = snapshots.get(col_name)
        if docs is None:
            return None
        normalized_docs = [_normalize_for_digest(d) for d in docs]
        normalized_docs.sort(
            key=lambda d: str(d.get("_id") or d.get("id") or "") if isinstance(d, dict) else str(d)
        )
        payload[col_name] = normalized_docs
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def hydrate_all_from_mongo(
    session: Session,
    clear_existing: bool = False,
    mongo_db: Optional[Database] = None,
) -> Dict[str, int]:
    """Hydrate all tables from MongoDB Atlas collections into the in-memory engine on startup or on demand."""
    global _last_mongo_pull_ts
    db = mongo_db if mongo_db is not None else get_mongo_db()
    if db is None:
        return {}

    logger.info("Hydrating in-memory database directly from MongoDB Atlas (clear_existing=%s)...", clear_existing)
    with _mongo_pull_lock:
        snapshots = _fetch_mongo_collections(db)
        prev_skip = session.info.get("_skip_mongo_replication", False)
        session.info["_skip_mongo_replication"] = True
        try:
            summary = _reconcile_from_mongo_session(
                session,
                db,
                clear_existing=clear_existing,
                prefetched=snapshots,
            )
            session.commit()
            _last_mongo_pull_ts = time.monotonic()
            digest = _compute_snapshots_digest(snapshots)
            if digest is not None:
                from app.core.database import get_session_factory
                _last_mongo_snapshot_digests[(id(db), id(get_session_factory()))] = digest
        finally:
            session.info["_skip_mongo_replication"] = prev_skip

    hydrated = {k: int(summary.get(k, 0)) for k in _SYNC_COLLECTION_NAMES}
    logger.info("Successfully hydrated all data directly from MongoDB Atlas: %s", hydrated)
    return hydrated


def sync_from_mongo_if_stale(
    min_interval_seconds: float = _DEFAULT_SYNC_INTERVAL_SECONDS,
    force: bool = False,
    mongo_db: Optional[Database] = None,
    session_factory_override: Any = None,
) -> Dict[str, Any]:
    """
    Pull latest changes from MongoDB Atlas into the in-memory SQLite cache when stale.
    Thread-safe, throttled, non-destructive, and silent in test environments.
    """
    global _last_mongo_pull_ts

    if mongo_db is None and session_factory_override is None:
        settings = get_settings()
        if settings.APP_ENV in {"test", "testing"} or not HAS_PYMONGO:
            return {"synced": False, "reason": "disabled", "changed": 0}

    now = time.monotonic()
    if not force and _last_mongo_pull_ts > 0 and (now - _last_mongo_pull_ts) < min_interval_seconds:
        return {"synced": False, "reason": "fresh", "changed": 0}

    with _mongo_pull_lock:
        now = time.monotonic()
        if not force and _last_mongo_pull_ts > 0 and (now - _last_mongo_pull_ts) < min_interval_seconds:
            return {"synced": False, "reason": "fresh", "changed": 0}

        db = mongo_db if mongo_db is not None else get_mongo_db()
        if db is None:
            _last_mongo_pull_ts = time.monotonic()
            return {"synced": False, "reason": "unavailable", "changed": 0}

        if session_factory_override is None:
            from app.core.database import get_session_factory
            session_factory = get_session_factory()
        else:
            session_factory = session_factory_override

        # Fetch from MongoDB over the network before opening a local SQLite transaction.
        snapshots = _fetch_mongo_collections(db)
        digest_key = (id(db), id(session_factory))
        digest = _compute_snapshots_digest(snapshots)
        if not force and digest is not None and _last_mongo_snapshot_digests.get(digest_key) == digest:
            _last_mongo_pull_ts = time.monotonic()
            return {"synced": True, "reason": "unchanged", "changed": 0}

        sync_session: Session = session_factory()
        try:
            sync_session.info["_skip_mongo_replication"] = True
            summary = _reconcile_from_mongo_session(
                sync_session,
                db,
                clear_existing=False,
                prefetched=snapshots,
            )
            if summary.get("changed", 0) > 0:
                sync_session.commit()
                logger.info(
                    "Live MongoDB -> SQLite sync applied (inserted=%d, updated=%d, deleted=%d).",
                    summary["inserted"],
                    summary["updated"],
                    summary["deleted"],
                )
            else:
                sync_session.rollback()
            _last_mongo_pull_ts = time.monotonic()
            if digest is not None:
                _last_mongo_snapshot_digests[digest_key] = digest
            return {"synced": True, "reason": "ok", **summary}
        except Exception as exc:
            try:
                sync_session.rollback()
            except Exception:
                pass
            _last_mongo_pull_ts = time.monotonic()
            logger.warning("Incremental MongoDB sync failed safely: %s", exc)
            return {"synced": False, "reason": f"error: {exc}", "changed": 0}
        finally:
            sync_session.close()
