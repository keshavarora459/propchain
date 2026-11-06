"""
Notification Endpoints for PropChain.
Allows authenticated users to view alerts, retrieve unread counts, and acknowledge notifications.
"""
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.notification import (
    MarkAllReadResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Notifications"])


@router.get(
    "",
    response_model=List[NotificationResponse],
    summary="List current user's notifications (latest first)",
)
def get_user_notifications(
    unread: Optional[bool] = Query(None, description="Filter for unread notifications only if true"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = NotificationService(db)
    return service.list_notifications(
        user_id=current_user.id,
        unread_only=bool(unread),
        limit=limit,
        skip=skip,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notifications count for logged in user",
)
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = NotificationService(db)
    count = service.get_unread_count(user_id=current_user.id)
    return UnreadCountResponse(unread_count=count, count=count)


@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark single notification as read",
)
def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = NotificationService(db)
    return service.mark_as_read(notification_id=notification_id, user_id=current_user.id)


@router.post(
    "/read-all",
    response_model=MarkAllReadResponse,
    summary="Mark all unread notifications as read",
)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = NotificationService(db)
    count = service.mark_all_as_read(user_id=current_user.id)
    return MarkAllReadResponse(success=True, marked_count=count)

