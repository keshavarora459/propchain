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
    if _mongo_client is None:
        settings = get_settings()
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

    # 1. Users
    u_count = 0
    for u_doc in db["users"].find():
        try:
            data = {k: v for k, v in u_doc.items() if not k.startswith("_") and k in User.__table__.columns}
            data["id"] = uuid.UUID(str(u_doc["_id"]))
            session.add(User(**data))
            u_count += 1
        except Exception as e:
            logger.warning("Could not hydrate user %s: %s", u_doc.get("_id"), e)
    session.flush()
    hydrated["users"] = u_count

    # 2. Properties
    p_count = 0
    for p_doc in db["properties"].find():
        try:
            data = {k: v for k, v in p_doc.items() if not k.startswith("_") and k in Property.__table__.columns}
            data["id"] = uuid.UUID(str(p_doc["_id"]))
            if data.get("creator_user_id"):
                data["creator_user_id"] = uuid.UUID(str(data["creator_user_id"]))
            if data.get("current_owner_id"):
                data["current_owner_id"] = uuid.UUID(str(data["current_owner_id"]))
            session.add(Property(**data))
            p_count += 1
        except Exception as e:
            logger.warning("Could not hydrate property %s: %s", p_doc.get("_id"), e)
    session.flush()
    hydrated["properties"] = p_count

    # 3. Documents
    d_count = 0
    for d_doc in db["documents"].find():
        try:
            data = {k: v for k, v in d_doc.items() if not k.startswith("_") and k in PropertyDocument.__table__.columns}
            data["id"] = uuid.UUID(str(d_doc["_id"]))
            if data.get("property_id"):
                data["property_id"] = uuid.UUID(str(data["property_id"]))
            if data.get("uploader_user_id"):
                data["uploader_user_id"] = uuid.UUID(str(data["uploader_user_id"]))
            session.add(PropertyDocument(**data))
            d_count += 1
        except Exception as e:
            logger.warning("Could not hydrate document %s: %s", d_doc.get("_id"), e)
    session.flush()
    hydrated["documents"] = d_count

    # 4. Transactions
    t_count = 0
    for t_doc in db["transactions"].find():
        try:
            data = {k: v for k, v in t_doc.items() if not k.startswith("_") and k in PropertyTransaction.__table__.columns}
            data["id"] = uuid.UUID(str(t_doc["_id"]))
            if data.get("property_id"):
                data["property_id"] = uuid.UUID(str(data["property_id"]))
            if data.get("buyer_user_id"):
                data["buyer_user_id"] = uuid.UUID(str(data["buyer_user_id"]))
            if data.get("seller_user_id"):
                data["seller_user_id"] = uuid.UUID(str(data["seller_user_id"]))
            session.add(PropertyTransaction(**data))
            t_count += 1
        except Exception as e:
            logger.warning("Could not hydrate transaction %s: %s", t_doc.get("_id"), e)
    session.flush()
    hydrated["transactions"] = t_count

    # 5. Approvals
    a_count = 0
    for a_doc in db["approvals"].find():
        try:
            data = {k: v for k, v in a_doc.items() if not k.startswith("_") and k in TransactionApproval.__table__.columns}
            data["id"] = uuid.UUID(str(a_doc["_id"]))
            if data.get("transaction_id"):
                data["transaction_id"] = uuid.UUID(str(data["transaction_id"]))
            if data.get("approver_user_id"):
                data["approver_user_id"] = uuid.UUID(str(data["approver_user_id"]))
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
            data = {k: v for k, v in o_doc.items() if not k.startswith("_") and k in OwnershipEvent.__table__.columns}
            data["id"] = uuid.UUID(str(o_doc["_id"]))
            if data.get("property_id"):
                data["property_id"] = uuid.UUID(str(data["property_id"]))
            if data.get("transaction_id"):
                data["transaction_id"] = uuid.UUID(str(data["transaction_id"]))
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
            data = {k: v for k, v in w_doc.items() if not k.startswith("_") and k in UserWallet.__table__.columns}
            data["id"] = uuid.UUID(str(w_doc["_id"]))
            if data.get("user_id"):
                data["user_id"] = uuid.UUID(str(data["user_id"]))
            session.add(UserWallet(**data))
            w_count += 1
        except Exception as e:
            logger.warning("Could not hydrate wallet %s: %s", w_doc.get("_id"), e)
    session.flush()
    hydrated["wallets"] = w_count

    session.commit()
    logger.info("Successfully hydrated all data directly from MongoDB Atlas: %s", hydrated)
    return hydrated

