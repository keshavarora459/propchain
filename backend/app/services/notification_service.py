"""
Notification Service Layer for PropChain.
Manages persistent user notification dispatch, retrieval, and status lifecycle.
"""
from datetime import datetime, timezone
from typing import List, Optional
import uuid

from sqlalchemy import desc, func, select, update
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.notification import Notification

logger = get_logger("notification_service")


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def notify(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str,
        type: str = "INFO",
        link: Optional[str] = None,
    ) -> Notification:
        """
        Creates and persists a real notification for the target user.
        """
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            link=link,
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(notif)
        try:
            self.db.commit()
            self.db.refresh(notif)
            logger.info("Notification sent to user %s: [%s] %s", user_id, type, title)
        except Exception as e:
            self.db.rollback()
            logger.error("Failed to commit notification for user %s: %s", user_id, e)
            raise e
        return notif

    def list_notifications(
        self,
        user_id: uuid.UUID,
        unread_only: bool = False,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Notification]:
        """
        Retrieves notifications for the designated user, latest first.
        """
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(desc(Notification.created_at))
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))

        stmt = stmt.offset(skip).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_unread_count(self, user_id: uuid.UUID) -> int:
        """
        Computes total unread notifications for the specified user.
        """
        stmt = (
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        )
        count = self.db.scalar(stmt) or 0
        return int(count)

    def mark_as_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> Notification:
        """
        Marks a single notification as read if owned by the user.
        """
        stmt = select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
        notif = self.db.scalars(stmt).first()
        if not notif:
            raise NotFoundError(f"Notification with ID '{notification_id}' not found.")

        notif.is_read = True
        self.db.commit()
        self.db.refresh(notif)
        return notif

    def mark_all_as_read(self, user_id: uuid.UUID) -> int:
        """
        Marks all unread notifications for the specified user as read.
        """
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        result = self.db.execute(stmt)
        self.db.commit()
        return result.rowcount or 0


def notify(
    user_id: uuid.UUID,
    title: str,
    message: str,
    type: str = "INFO",
    link: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[Notification]:
    """
    Global helper function to dispatch a notification with next-step guidance.
    Uses provided database session or acquires one from session factory.
    """
    if not user_id:
        return None

    try:
        if db is not None:
            service = NotificationService(db)
            return service.notify(
                user_id=user_id,
                title=title,
                message=message,
                type=type,
                link=link,
            )
        else:
            from app.core.database import get_session_factory
            session_factory = get_session_factory()
            with session_factory() as session:
                service = NotificationService(session)
                return service.notify(
                    user_id=user_id,
                    title=title,
                    message=message,
                    type=type,
                    link=link,
                )
    except Exception as exc:
        logger.warning("Error dispatching notification to %s: %s", user_id, exc)
        return None

