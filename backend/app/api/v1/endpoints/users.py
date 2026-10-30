"""
User Profile and Management Endpoints for PropChain API v1.
Implements self-profile management and administrative oversight.
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.exceptions import PropChainException
from app.core.permissions import UserRole
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.permissions import require_role
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.user import (
    UserListResponse,
    UserResponse,
    UserStatusUpdateRequest,
    UserUpdateRequest,
)
from app.services.user_service import user_service

router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description="Retrieve profile details and granted permissions for the authenticated user.",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return authenticated user profile."""
    return user_service.get_profile(current_user)


@router.patch(
    "/me",
    response_model=APIResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Update Current User Profile",
    description="Update permitted profile fields (full_name, phone_number).",
)
async def update_my_profile(
    update_data: UserUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[UserResponse]:
    """Update authenticated user profile."""
    ip_addr = request.client.host if request.client else None
    updated = user_service.update_profile(
        db=db,
        user=current_user,
        update_data=update_data,
        ip_address=ip_addr,
    )
    return APIResponse[UserResponse](
        success=True,
        message="Profile updated successfully.",
        data=updated,
    )


@router.get(
    "",
    response_model=UserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Users (Admin Only)",
    description="Retrieve paginated list of registered users with role and status filters.",
)
async def list_users(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    role: Optional[str] = Query(default=None, description="Filter by UserRole"),
    status: Optional[str] = Query(default=None, description="Filter by AccountStatus"),
    search: Optional[str] = Query(default=None, description="Search by name or email"),
    _admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> UserListResponse:
    """Administrator listing of all users."""
    return user_service.list_users_admin(
        db=db,
        page=page,
        page_size=page_size,
        role_filter=role,
        status_filter=status,
        search=search,
    )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get User Details",
    description="Retrieve specific user details. Allowed for Admin or the user themselves.",
)
async def get_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    """Get user details by ID."""
    # Allow if user is ADMIN or requesting their own record
    if current_user.role != UserRole.ADMIN.value and current_user.id != user_id:
        raise PropChainException(
            message="Access denied: You may only view your own user record.",
            status_code=403,
        )
    return user_service.get_user_by_id(db, user_id)


@router.patch(
    "/{user_id}/status",
    response_model=APIResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="Update User Account Status (Admin Only)",
    description="Activate or suspend a user account. Automatically invalidates active sessions upon suspension.",
)
async def update_user_status(
    user_id: uuid.UUID,
    update_data: UserStatusUpdateRequest,
    request: Request,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> APIResponse[UserResponse]:
    """Admin action to update account status."""
    ip_addr = request.client.host if request.client else None
    updated = user_service.update_user_status_admin(
        db=db,
        target_user_id=user_id,
        update_data=update_data,
        admin_user_id=admin_user.id,
        ip_address=ip_addr,
    )
    return APIResponse[UserResponse](
        success=True,
        message=f"User account status updated to {update_data.account_status.value}.",
        data=updated,
    )

