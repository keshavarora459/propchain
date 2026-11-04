"""
User Service Layer for PropChain.
Manages profile retrieval, permitted self-updates, and administrative user management.
"""
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import PropChainException, ResourceNotFoundException
from app.core.logging import get_logger
from app.models.user import User
from app.repositories.user_repository import user_repository
from app.schemas.user import (
    UserListResponse,
    UserResponse,
    UserStatusUpdateRequest,
    UserUpdateRequest,
)

logger = get_logger("services.user")


class UserService:
    """Service handling profile operations and administrator oversight."""

    def get_profile(self, user: User) -> UserResponse:
        """Return structured profile for current user."""
        return UserResponse.from_orm_with_permissions(user)

    def update_profile(
        self,
        db: Session,
        user: User,
        update_data: UserUpdateRequest,
        ip_address: Optional[str] = None,
    ) -> UserResponse:
        """Update permitted self-profile fields (full_name, phone_number)."""
        updated_user = user_repository.update_user(
            db,
            user,
            full_name=update_data.full_name,
            phone_number=update_data.phone_number,
        )
        user_repository.record_activity(
            db=db,
            user_id=user.id,
            activity_type="PROFILE_UPDATED",
            description="User updated profile information",
            ip_address=ip_address,
        )
        return UserResponse.from_orm_with_permissions(updated_user)

    def get_user_by_id(self, db: Session, user_id: uuid.UUID) -> UserResponse:
        """Look up user by ID or raise 404."""
        user = user_repository.get_by_id(db, user_id)
        if not user:
            raise ResourceNotFoundException("User not found.")
        return UserResponse.from_orm_with_permissions(user)

    def list_users_admin(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        role_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> UserListResponse:
        """Administrative query of platform users with filters and pagination."""
        skip = (page - 1) * page_size
        users = user_repository.list_users(
            db=db,
            skip=skip,
            limit=page_size,
            role_filter=role_filter,
            status_filter=status_filter,
            search=search,
        )
        total = user_repository.count_users(
            db=db,
            role_filter=role_filter,
            status_filter=status_filter,
            search=search,
        )
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        user_responses = [UserResponse.from_orm_with_permissions(u) for u in users]
        return UserListResponse(
            users=user_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def update_user_status_admin(
        self,
        db: Session,
        target_user_id: uuid.UUID,
        update_data: UserStatusUpdateRequest,
        admin_user_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> UserResponse:
        """Admin action to update account status (activate/suspend)."""
        target_user = user_repository.get_by_id(db, target_user_id)
        if not target_user:
            raise ResourceNotFoundException("Target user not found.")

        # Prevent admin from suspending themselves
        if target_user.id == admin_user_id and update_data.account_status.value != "ACTIVE":
            raise PropChainException(
                message="Administrators cannot suspend their own active accounts.",
                status_code=400,
            )

        updated_user = user_repository.update_user(
            db, target_user, account_status=update_data.account_status.value
        )

        # If suspending account, terminate all their active sessions immediately
        if update_data.account_status.value == "SUSPENDED":
            user_repository.revoke_all_user_tokens(db, target_user.id)

        user_repository.record_activity(
            db=db,
            user_id=admin_user_id,
            activity_type="ADMIN_STATUS_UPDATE",
            description=f"Admin changed user {target_user.id} status to {update_data.account_status.value}",
            ip_address=ip_address,
        )
        return UserResponse.from_orm_with_permissions(updated_user)

    def delete_user_admin(
        self,
        db: Session,
        target_user_id: uuid.UUID,
        admin_user_id: uuid.UUID,
        ip_address: Optional[str] = None,
    ) -> bool:
        """Admin action to permanently delete a user account."""
        target_user = user_repository.get_by_id(db, target_user_id)
        if not target_user:
            raise ResourceNotFoundException("Target user not found.")

        # Prevent admin from deleting themselves
        if target_user.id == admin_user_id:
            raise PropChainException(
                message="Administrators cannot delete their own active accounts.",
                status_code=400,
            )

        user_email = target_user.email
        deleted = user_repository.delete_user(db, target_user_id)

        user_repository.record_activity(
            db=db,
            user_id=admin_user_id,
            activity_type="ADMIN_USER_DELETE",
            description=f"Admin deleted user {user_email} (ID: {target_user_id})",
            ip_address=ip_address,
        )
        return deleted


user_service = UserService()

