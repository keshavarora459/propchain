"""
Permission and Role Enforcement Dependencies for PropChain.
Enforces RBAC matrix and prevents privilege escalation on protected endpoints.
"""
from typing import Callable, Iterable
from fastapi import Depends

from app.core.exceptions import PropChainException
from app.core.permissions import Permission, UserRole, has_permission
from app.dependencies.auth import get_current_user
from app.models.user import User


def require_role(*roles: UserRole) -> Callable:
    """Dependency factory that restricts route access to one of the specified roles."""
    allowed_role_values = {r.value for r in roles}

    async def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_role_values:
            allowed_names = ", ".join(r.value for r in roles)
            raise PropChainException(
                message=f"Access denied: This action requires one of the following roles: {allowed_names}.",
                status_code=403,
            )
        return current_user

    return _role_checker


def require_permission(permission: Permission) -> Callable:
    """Dependency factory that checks if current user's role has the designated permission."""
    async def _permission_checker(current_user: User = Depends(get_current_user)) -> User:
        role_enum = UserRole(current_user.role) if current_user.role in UserRole.__members__ else UserRole.BUYER
        if not has_permission(role_enum, permission):
            raise PropChainException(
                message=f"Access denied: Insufficient privileges for permission '{permission.value}'.",
                status_code=403,
            )
        return current_user

    return _permission_checker

