"""
SQLAlchemy 2.x Declarative Base Model and Mixins for PropChain.
Establishes standardized UUID primary keys and timezone-aware timestamps.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from sqlalchemy import DateTime, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime for column defaults."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Root declarative base class for all SQLAlchemy ORM models."""

    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance attributes to a dictionary."""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }

    def __repr__(self) -> str:
        attrs = ", ".join(
            f"{c.name}={getattr(self, c.name)!r}"
            for c in self.__table__.columns
        )
        return f"<{self.__class__.__name__}({attrs})>"


class TimestampMixin:
    """Mixin that injects UTC timezone-aware created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """Mixin that injects a UUID v4 primary key."""

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        nullable=False,
    )


class BaseModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Abstract base entity model combining UUID primary key and timestamp tracking.
    All future domain models (Property, Ownership, Transaction, etc.) inherit from this.
    """

    __abstract__ = True

