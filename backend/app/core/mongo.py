"""
MongoDB Atlas Storage and Dual-State Sync Engine for PropChain.
Manages persistent document storage in MongoDB Atlas cluster with real-time entity replication.
"""
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
    "AuditLog": "audit_logs",
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
        _mongo_client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            maxPoolSize=20,
        )
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
    """Register event hooks on SQLAlchemy Session to replicate changes to MongoDB in real time."""
    @event.listens_for(Session, "after_flush")
    def receive_after_flush(session: Session, flush_context: Any) -> None:
        """Capture all new, modified, and deleted entities and replicate to MongoDB."""
        for instance in list(session.new):
            sync_entity_to_mongo(instance)

        for instance in list(session.dirty):
            sync_entity_to_mongo(instance)

        for instance in list(session.deleted):
            delete_entity_from_mongo(instance)

    logger.info("Registered SQLAlchemy real-time MongoDB replication listener.")

