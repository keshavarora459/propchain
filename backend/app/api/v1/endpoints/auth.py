"""
Authentication Endpoints for PropChain API v1.
Implements user registration, credential login, token rotation, and logout.
"""
from typing import Optional
from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import PropChainException
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.schemas.common import APIResponse
from app.schemas.user import UserResponse
from app.services.auth_service import auth_service

router = APIRouter()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set secure HTTP-only cookie containing the refresh token."""
    settings = get_settings()
    max_age = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear HTTP-only refresh cookie."""
    settings = get_settings()
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


@router.post(
    "/register",
    response_model=APIResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    summary="User Registration",
    description="Register a new buyer or property owner account.",
)
async def register(
    request_data: UserRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> APIResponse[UserResponse]:
    """Register a new user account."""
    ip_addr = request.client.host if request.client else None
    user_resp = auth_service.register_user(db, request_data, ip_address=ip_addr)
    return APIResponse[UserResponse](
        success=True,
        message="Registration successful. Welcome to PropChain.",
        data=user_resp,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticate with email and password to receive JWT access and refresh tokens.",
)
async def login(
    request_data: UserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate credentials and generate token pair."""
    ip_addr = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    token_resp, refresh_token_str = auth_service.login_user(
        db=db,
        request=request_data,
        ip_address=ip_addr,
        user_agent=user_agent,
    )
    _set_refresh_cookie(response, refresh_token_str)
    return token_resp


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description="Rotate refresh token and issue a fresh access token pair.",
)
async def refresh_token(
    request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    propchain_refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Rotate refresh token. Accepts token via HTTP-only cookie or request body."""
    # Request body refresh token takes precedence over cookie if explicitly supplied
    token_candidate = (body.refresh_token if body and body.refresh_token else None) or propchain_refresh_token
    if not token_candidate:
        raise PropChainException(
            message="Refresh token is required in cookie or body.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    ip_addr = request.client.host if request.client else None
    token_resp, new_refresh_str = auth_service.refresh_access_token(
        db=db,
        refresh_token_str=token_candidate,
        ip_address=ip_addr,
    )
    _set_refresh_cookie(response, new_refresh_str)
    return token_resp


@router.post(
    "/logout",
    response_model=APIResponse[None],
    status_code=status.HTTP_200_OK,
    summary="User Logout",
    description="Revoke the active refresh token session and clear authentication cookies.",
)
async def logout(
    request: Request,
    response: Response,
    body: Optional[RefreshTokenRequest] = None,
    propchain_refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> APIResponse[None]:
    """Revoke refresh session and clear cookie."""
    token_candidate = (body.refresh_token if body and body.refresh_token else None) or propchain_refresh_token
    ip_addr = request.client.host if request.client else None
    auth_service.logout_user(
        db=db,
        refresh_token_str=token_candidate,
        user_id=None,
        ip_address=ip_addr,
    )
    _clear_refresh_cookie(response)
    return APIResponse[None](
        success=True,
        message="Logged out successfully. Authentication session terminated.",
        data=None,
    )


@router.post(
    "/change-password",
    response_model=APIResponse[None],
    status_code=status.HTTP_200_OK,
    summary="Change Password",
    description="Update user password and revoke existing sessions.",
)
async def change_password(
    request_data: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> APIResponse[None]:
    """Change current user password."""
    ip_addr = request.client.host if request.client else None
    auth_service.change_password(
        db=db,
        user=current_user,
        request=request_data,
        ip_address=ip_addr,
    )
    _clear_refresh_cookie(response)
    return APIResponse[None](
        success=True,
        message="Password updated successfully. Please authenticate with your new password.",
        data=None,
    )
