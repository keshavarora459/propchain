"""
Notification Pydantic Schemas for PropChain.
Defines serialization models for user notification delivery and unread counting.
"""
from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    """Serialized notification representation."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    """Unread notifications count."""
    unread_count: int
    count: int


class MarkAllReadResponse(BaseModel):
    """Mark all notifications read result."""
    success: bool
    marked_count: int

