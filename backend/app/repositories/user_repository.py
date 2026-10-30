"""
Repository Layer for User, Session, and Audit Management.
Encapsulates all database operations using SQLAlchemy 2.x select queries.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import AccountStatus, UserRole
from app.models.login_attempt import LoginAttempt
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.user_activity import UserActivityLog


class UserRepository:
    """Database repository for user identities and authentication records."""

    def get_by_id(self, db: Session, user_id: uuid.UUID) -> Optional[User]:
        """Fetch user by unique primary key."""
        stmt = select(User).where(User.id == user_id)
        return db.scalars(stmt).first()

    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        """Fetch user by normalized lowercase email address."""
        stmt = select(User).where(func.lower(User.email) == email.lower().strip())
        return db.scalars(stmt).first()

    def create_user(
        self,
        db: Session,
        full_name: str,
        email: str,
        password_hash: str,
        phone_number: Optional[str] = None,
        role: str = UserRole.BUYER.value,
        account_status: str = AccountStatus.ACTIVE.value,
        email_verified: bool = False,
    ) -> User:
        """Create and persist a new user entity."""
        user = User(
            full_name=full_name.strip(),
            email=email.lower().strip(),
            password_hash=password_hash,
            phone_number=phone_number.strip() if phone_number else None,
            role=role,
            account_status=account_status,
            email_verified=email_verified,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def update_user(self, db: Session, user: User, **kwargs) -> User:
        """Update specified fields on an existing user."""
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        return user

    def list_users(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        role_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[User]:
        """Query paginated users with optional role, status, and search filters."""
        stmt = select(User)
        if role_filter:
            stmt = stmt.where(User.role == role_filter)
        if status_filter:
            stmt = stmt.where(User.account_status == status_filter)
        if search:
            search_pattern = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.full_name).like(search_pattern),
                    func.lower(User.email).like(search_pattern),
                )
            )
        stmt = stmt.order_by(User.created_at.desc()).offset(skip).limit(limit)
        return list(db.scalars(stmt).all())

    def count_users(
        self,
        db: Session,
        role_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> int:
        """Count total users matching criteria for pagination."""
        stmt = select(func.count(User.id))
        if role_filter:
            stmt = stmt.where(User.role == role_filter)
        if status_filter:
            stmt = stmt.where(User.account_status == status_filter)
        if search:
            search_pattern = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.full_name).like(search_pattern),
                    func.lower(User.email).like(search_pattern),
                )
            )
        return db.scalar(stmt) or 0

    # -------------------------------------------------------------------------
    # Refresh Token Session Operations
    # -------------------------------------------------------------------------
    def store_refresh_token(
        self,
        db: Session,
        user_id: uuid.UUID,
        token_jti: str,
        token_hash: str,
        expires_at: datetime,
    ) -> RefreshToken:
        """Store hashed refresh token record in the database."""
        token_record = RefreshToken(
            user_id=user_id,
            token_jti=token_jti,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(token_record)
        db.commit()
        db.refresh(token_record)
        return token_record

    def get_refresh_token_by_jti(self, db: Session, jti: str) -> Optional[RefreshToken]:
        """Find refresh token record by unique JTI."""
        stmt = select(RefreshToken).where(RefreshToken.token_jti == jti)
        return db.scalars(stmt).first()

    def revoke_refresh_token(
        self,
        db: Session,
        token_record: RefreshToken,
        replaced_by_jti: Optional[str] = None,
    ) -> None:
        """Mark a single refresh token revoked and optionally record replacement JTI."""
        token_record.revoked_at = datetime.now(timezone.utc)
        if replaced_by_jti:
            token_record.replaced_by_jti = replaced_by_jti
        db.commit()

    def revoke_all_user_tokens(self, db: Session, user_id: uuid.UUID) -> int:
        """Revoke all active tokens for a user (e.g., token reuse alarm, password change)."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
        )
        active_tokens = list(db.scalars(stmt).all())
        for t in active_tokens:
            t.revoked_at = now
        db.commit()
        return len(active_tokens)

    # -------------------------------------------------------------------------
    # Rate Limiting & Login Attempt Tracking
    # -------------------------------------------------------------------------
    def record_login_attempt(
        self,
        db: Session,
        email: str,
        success: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> LoginAttempt:
        """Log an authentication attempt for audit and rate-limiting."""
        attempt = LoginAttempt(
            email_identifier=email.lower().strip(),
            success=success,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(attempt)
        db.commit()
        return attempt

    def count_recent_failed_attempts(
        self,
        db: Session,
        email: str,
        window_minutes: int = 15,
    ) -> int:
        """Count failed logins within recent time window."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        stmt = (
            select(func.count(LoginAttempt.id))
            .where(LoginAttempt.email_identifier == email.lower().strip())
            .where(LoginAttempt.success.is_(False))
            .where(LoginAttempt.created_at >= cutoff)
        )
        return db.scalar(stmt) or 0

    # -------------------------------------------------------------------------
    # User Activity Logging
    # -------------------------------------------------------------------------
    def record_activity(
        self,
        db: Session,
        user_id: Optional[uuid.UUID],
        activity_type: str,
        description: str,
        ip_address: Optional[str] = None,
    ) -> UserActivityLog:
        """Record high-value security or user lifecycle event."""
        log_entry = UserActivityLog(
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            ip_address=ip_address,
        )
        db.add(log_entry)
        db.commit()
        return log_entry


user_repository = UserRepository()

