"""
MongoDB Atlas Storage and Dual-State Sync Engine for PropChain.
Manages persistent document storage in MongoDB Atlas cluster with real-time entity replication.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple
import uuid

import pymongo
from pymongo import MongoClient
from pymongo.database import Database
from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("core.mongo")

_mongo_client: Optional[MongoClient] = None
_mongo_db: Optional[Database] = None
_mongo_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="mongo_sync")

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
    "LoginAttempt": "login_attempts",
    "RefreshToken": "refresh_tokens",
}


def get_mongo_client() -> MongoClient:
    """Obtain or initialize the singleton MongoClient."""
    global _mongo_client
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        return None
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

        client_kwargs = {
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 5000,
            "socketTimeoutMS": 10000,
            "maxPoolSize": 20,
            "tls": True,
            "tlsAllowInvalidCertificates": True,
        }
        if ca_file:
            client_kwargs["tlsCAFile"] = ca_file

        _mongo_client = MongoClient(uri, **client_kwargs)
    return _mongo_client


def get_mongo_db() -> Optional[Database]:
    """Obtain the configured MongoDB database."""
    global _mongo_db
    if _mongo_db is None:
        client = get_mongo_client()
        if client is None:
            return None
        settings = get_settings()
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
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        return False, "MongoDB disabled in test environment", {}
    try:
        client = get_mongo_client()
        info = client.server_info()
        db = get_mongo_db()
        collections = db.list_collection_names()
        stats = {col: db[col].count_documents({}) for col in collections}
        return True, f"MongoDB Connected (v{info.get('version', 'unknown')})", {
            "collections": collections,
            "counts": stats,
            "cluster_database": db.name,
        }
    except Exception as exc:
        logger.error("MongoDB health check failed: %s", exc)
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
            db[collection_name].delete_one({"_id": entity_id})
            logger.debug("Deleted %s [%s] from MongoDB collection '%s'", model_name, entity_id, collection_name)
    except Exception as exc:
        logger.warning("Failed to delete %s [%s] from MongoDB: %s", model_name, getattr(entity, "id", None), exc)


def sync_all_to_mongo(session: Session) -> Dict[str, int]:
    """Perform a complete sync of all existing entities from database to MongoDB."""
    logger.info("Executing comprehensive database -> MongoDB initial synchronization...")
    results: Dict[str, int] = {}
    db = get_mongo_db()

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


# SQLAlchemy Automatic Event Hook
def setup_sqlalchemy_mongo_listener() -> None:
    """Register event hooks on SQLAlchemy Session to replicate changes to MongoDB in real time asynchronously."""
    settings = get_settings()
    if settings.APP_ENV in {"test", "testing"}:
        return
    @event.listens_for(Session, "after_flush")
    def receive_after_flush(session: Session, flush_context: Any) -> None:
        """Capture all new, modified, and deleted entities and replicate to MongoDB in background threads."""
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

        def _bg_replicate():
            db = get_mongo_db()
            if db is None:
                return
            for model_name, doc in new_items + dirty_items:
                col_name = COLLECTION_MAPPING.get(model_name)
                if col_name and "_id" in doc:
                    try:
                        db[col_name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                    except Exception as e:
                        logger.debug("Mongo bg sync notice for %s: %s", model_name, e)
            for model_name, ent_id in del_items:
                col_name = COLLECTION_MAPPING.get(model_name)
                if col_name and ent_id:
                    try:
                        db[col_name].delete_one({"_id": ent_id})
                    except Exception as e:
                        logger.debug("Mongo bg delete notice for %s: %s", model_name, e)

        if new_items or dirty_items or del_items:
            _mongo_executor.submit(_bg_replicate)

    logger.info("Registered SQLAlchemy real-time MongoDB asynchronous replication listener.")


def safe_uuid(val: Any) -> Optional[uuid.UUID]:
    """Safely convert any value to UUID, returning None if invalid or empty."""
    if not val:
        return None
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return None


def hydrate_all_from_mongo(session: Session) -> Dict[str, int]:
    """Hydrate all tables from MongoDB Atlas collections into the in-memory engine on startup."""
    db = get_mongo_db()
    if db is None:
        return {}

    from app.models.approval import TransactionApproval
    from app.models.blockchain import BlockchainEvent, OwnershipEvent
    from app.models.document import PropertyDocument
    from app.models.property import Property
    from app.models.transaction import PropertyTransaction
    from app.models.user import User
    from app.models.wallet import UserWallet

    logger.info("Hydrating in-memory database directly from MongoDB Atlas...")
    hydrated: Dict[str, int] = {}

    # 1. Users (Deduplicate by email and ID, prioritizing most recently updated)
    u_count = 0
    seen_user_ids = set()
    seen_user_emails = {str(u[0]).lower() for u in session.query(User.email).all() if u[0]}
    admin_fallback_id = None

    for u_doc in db["users"].find().sort([("updated_at", -1), ("created_at", -1)]):
        try:
            u_id = safe_uuid(u_doc.get("_id"))
            if not u_id or u_id in seen_user_ids:
                continue
            email = str(u_doc.get("email", "")).lower().strip()
            if not email or email in seen_user_emails:
                continue

            data = {k: v for k, v in u_doc.items() if not k.startswith("_") and k in User.__table__.columns}
            data["id"] = u_id
            data["email"] = email
            session.add(User(**data))
            seen_user_ids.add(u_id)
            seen_user_emails.add(email)
            if data.get("role") == "ADMIN" and not admin_fallback_id:
                admin_fallback_id = u_id
            u_count += 1
        except Exception as e:
            logger.warning("Could not hydrate user %s: %s", u_doc.get("_id"), e)
    try:
        session.flush()
    except Exception as e:
        session.rollback()
        logger.warning("Failed to flush hydrated users, rolled back: %s", e)
    hydrated["users"] = u_count

    default_user_id = admin_fallback_id or (next(iter(seen_user_ids)) if seen_user_ids else None)

    # 2. Properties
    p_count = 0
    seen_prop_ids = set()
    for p_doc in db["properties"].find():
        try:
            p_id = safe_uuid(p_doc.get("_id"))
            if not p_id or p_id in seen_prop_ids:
                continue
            data = {k: v for k, v in p_doc.items() if not k.startswith("_") and k in Property.__table__.columns}
            data["id"] = p_id

            c_id = safe_uuid(data.get("creator_user_id"))
            if not c_id or c_id not in seen_user_ids:
                c_id = default_user_id
            data["creator_user_id"] = c_id

            o_id = safe_uuid(data.get("current_owner_id"))
            if not o_id or o_id not in seen_user_ids:
                o_id = c_id
            data["current_owner_id"] = o_id

            session.add(Property(**data))
            seen_prop_ids.add(p_id)
            p_count += 1
        except Exception as e:
            logger.warning("Could not hydrate property %s: %s", p_doc.get("_id"), e)
    session.flush()
    hydrated["properties"] = p_count

    # 3. Documents
    d_count = 0
    for d_doc in db["documents"].find():
        try:
            d_id = safe_uuid(d_doc.get("_id"))
            if not d_id:
                continue
            data = {k: v for k, v in d_doc.items() if not k.startswith("_") and k in PropertyDocument.__table__.columns}
            data["id"] = d_id

            p_id = safe_uuid(data.get("property_id"))
            if not p_id or p_id not in seen_prop_ids:
                continue
            data["property_id"] = p_id

            u_id = safe_uuid(data.get("uploader_user_id"))
            if not u_id or u_id not in seen_user_ids:
                u_id = default_user_id
            data["uploader_user_id"] = u_id

            session.add(PropertyDocument(**data))
            d_count += 1
        except Exception as e:
            logger.warning("Could not hydrate document %s: %s", d_doc.get("_id"), e)
    session.flush()
    hydrated["documents"] = d_count

    # 4. Transactions
    t_count = 0
    seen_tx_ids = set()
    for t_doc in db["transactions"].find():
        try:
            t_id = safe_uuid(t_doc.get("_id"))
            if not t_id or t_id in seen_tx_ids:
                continue
            data = {k: v for k, v in t_doc.items() if not k.startswith("_") and k in PropertyTransaction.__table__.columns}
            data["id"] = t_id

            p_id = safe_uuid(data.get("property_id"))
            if not p_id or p_id not in seen_prop_ids:
                continue
            data["property_id"] = p_id

            b_id = safe_uuid(data.get("buyer_id") or data.get("buyer_user_id"))
            if not b_id or b_id not in seen_user_ids:
                b_id = default_user_id
            data["buyer_id"] = b_id
            data.pop("buyer_user_id", None)

            s_id = safe_uuid(data.get("seller_id") or data.get("seller_user_id"))
            if not s_id or s_id not in seen_user_ids:
                s_id = default_user_id
            data["seller_id"] = s_id
            data.pop("seller_user_id", None)

            session.add(PropertyTransaction(**data))
            seen_tx_ids.add(t_id)
            t_count += 1
        except Exception as e:
            logger.warning("Could not hydrate transaction %s: %s", t_doc.get("_id"), e)
    session.flush()
    hydrated["transactions"] = t_count

    # 5. Approvals
    a_count = 0
    for a_doc in db["approvals"].find():
        try:
            a_id = safe_uuid(a_doc.get("_id"))
            if not a_id:
                continue
            data = {k: v for k, v in a_doc.items() if not k.startswith("_") and k in TransactionApproval.__table__.columns}
            data["id"] = a_id

            tx_id = safe_uuid(data.get("transaction_id"))
            if not tx_id or tx_id not in seen_tx_ids:
                continue
            data["transaction_id"] = tx_id

            ap_id = safe_uuid(data.get("approver_user_id"))
            if not ap_id or ap_id not in seen_user_ids:
                ap_id = default_user_id
            data["approver_user_id"] = ap_id

            session.add(TransactionApproval(**data))
            a_count += 1
        except Exception as e:
            logger.warning("Could not hydrate approval %s: %s", a_doc.get("_id"), e)
    session.flush()
    hydrated["approvals"] = a_count

    # 6. Ownership Events
    o_count = 0
    for o_doc in db["ownership_events"].find():
        try:
            o_id = safe_uuid(o_doc.get("_id"))
            if not o_id:
                continue
            data = {k: v for k, v in o_doc.items() if not k.startswith("_") and k in OwnershipEvent.__table__.columns}
            data["id"] = o_id

            p_id = safe_uuid(data.get("property_id"))
            if not p_id or p_id not in seen_prop_ids:
                continue
            data["property_id"] = p_id

            new_owner = safe_uuid(data.get("new_owner_id"))
            if not new_owner or new_owner not in seen_user_ids:
                new_owner = default_user_id
            data["new_owner_id"] = new_owner

            prev_owner = safe_uuid(data.get("previous_owner_id"))
            if prev_owner and prev_owner not in seen_user_ids:
                prev_owner = None
            data["previous_owner_id"] = prev_owner

            if data.get("transaction_id"):
                data["transaction_id"] = str(data["transaction_id"])

            session.add(OwnershipEvent(**data))
            o_count += 1
        except Exception as e:
            logger.warning("Could not hydrate ownership event %s: %s", o_doc.get("_id"), e)
    session.flush()
    hydrated["ownership_events"] = o_count

    # 7. Wallets
    w_count = 0
    for w_doc in db["wallets"].find():
        try:
            w_id = safe_uuid(w_doc.get("_id"))
            if not w_id:
                continue
            data = {k: v for k, v in w_doc.items() if not k.startswith("_") and k in UserWallet.__table__.columns}
            data["id"] = w_id
            u_id = safe_uuid(data.get("user_id"))
            if not u_id or u_id not in seen_user_ids:
                continue
            data["user_id"] = u_id
            session.add(UserWallet(**data))
            w_count += 1
        except Exception as e:
            logger.warning("Could not hydrate wallet %s: %s", w_doc.get("_id"), e)
    session.flush()
    hydrated["wallets"] = w_count

    session.commit()
    logger.info("Successfully hydrated all data directly from MongoDB Atlas: %s", hydrated)
    return hydrated


    session.commit()
    logger.info("Successfully hydrated all data directly from MongoDB Atlas: %s", hydrated)
    return hydrated

