"""
Centralized Role-Based Access Control (RBAC) and Permissions for PropChain.
Defines roles, account statuses, functional permissions, and authorization matrix.
"""
from enum import Enum
from typing import Any, Dict, FrozenSet, List, Set


class UserRole(str, Enum):
    """Supported user roles in the PropChain network."""
    ADMIN = "ADMIN"
    PROPERTY_OWNER = "PROPERTY_OWNER"
    BUYER = "BUYER"
    REGISTRAR = "REGISTRAR"
    VERIFIER = "VERIFIER"
    LEGAL_AUTHORITY = "LEGAL_AUTHORITY"


class AccountStatus(str, Enum):
    """Account lifecycle statuses."""
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"


class Permission(str, Enum):
    """Functional operational permissions."""
    VIEW_DASHBOARD = "view_dashboard"
    MANAGE_USERS = "manage_users"
    REGISTER_PROPERTY = "register_property"
    VIEW_PROPERTIES = "view_properties"
    INITIATE_TRANSACTION = "initiate_transaction"
    VERIFY_DOCUMENTS = "verify_documents"
    REVIEW_APPROVALS = "review_approvals"
    CONFIRM_LEGAL_REGISTRATION = "confirm_legal_registration"
    VIEW_FRAUD_ALERTS = "view_fraud_alerts"
    VIEW_BLOCKCHAIN_HISTORY = "view_blockchain_history"


# Exact authorization matrix based on approved specifications:
# Notice: An ADMIN must NOT be treated as a legal authority (no CONFIRM_LEGAL_REGISTRATION)
ROLE_PERMISSIONS: Dict[UserRole, FrozenSet[Permission]] = {
    UserRole.ADMIN: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.MANAGE_USERS,
        Permission.REGISTER_PROPERTY,
        Permission.VIEW_PROPERTIES,
        Permission.VERIFY_DOCUMENTS,
        Permission.REVIEW_APPROVALS,
        Permission.VIEW_FRAUD_ALERTS,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.PROPERTY_OWNER: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.REGISTER_PROPERTY,
        Permission.VIEW_PROPERTIES,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.BUYER: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_PROPERTIES,
        Permission.INITIATE_TRANSACTION,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.REGISTRAR: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_PROPERTIES,
        Permission.VERIFY_DOCUMENTS,
        Permission.REVIEW_APPROVALS,
        Permission.VIEW_FRAUD_ALERTS,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.VERIFIER: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_PROPERTIES,
        Permission.VERIFY_DOCUMENTS,
        Permission.REVIEW_APPROVALS,
        Permission.VIEW_FRAUD_ALERTS,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.LEGAL_AUTHORITY: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_PROPERTIES,
        Permission.REVIEW_APPROVALS,
        Permission.CONFIRM_LEGAL_REGISTRATION,  # ONLY Legal Authority has this
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
}

# Roles permitted during open public registration (Admin, Verifier, Legal Authority are restricted)
PUBLIC_REGISTRATION_ROLES: Set[UserRole] = {
    UserRole.BUYER,
    UserRole.PROPERTY_OWNER,
}


def has_permission(role: UserRole, permission: Permission) -> bool:
    """Check if a given role possesses a specific permission."""
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def get_role_permissions(role: UserRole) -> List[str]:
    """Retrieve all permission names granted to a specific role."""
    return [perm.value for perm in ROLE_PERMISSIONS.get(role, frozenset())]


def assert_property_access(current_user: Any, prop: Any, allow_marketplace: bool = True) -> None:
    """
    Enforce that a user has authorized access to a property.
    Admins, Verifiers, and Legal Authorities have system-wide access.
    Property owners can access properties they own or created.
    If allow_marketplace is True, any authenticated user can view active, verified marketplace listings.
    Otherwise, raises ForbiddenError.
    """
    from app.core.exceptions import ForbiddenError

    if not current_user:
        raise ForbiddenError("Authentication required.")

    raw_role = current_user.role
    user_role = raw_role.value if hasattr(raw_role, "value") else str(raw_role)

    # Privileged administrative and legal authority roles have global view privileges
    if user_role in {UserRole.ADMIN.value, UserRole.LEGAL_AUTHORITY.value}:
        return

    # Registrars can view submitted or verified properties, but draft (PENDING) properties are forbidden
    if user_role in {UserRole.REGISTRAR.value, UserRole.VERIFIER.value, "REGISTRAR", "VERIFIER"}:
        if getattr(prop, "verification_status", None) == "PENDING":
            raise ForbiddenError("Access denied: Draft properties cannot be viewed by registrars until submitted.")
        return

    # Check direct ownership or creation
    is_owner = (getattr(prop, "current_owner_id", None) == current_user.id) or (
        getattr(prop, "creator_user_id", None) == current_user.id
    )
    if is_owner:
        return

    # Marketplace view allowed only if verified and active
    if allow_marketplace:
        is_verified = getattr(prop, "verification_status", None) == "VERIFIED"
        is_active = getattr(prop, "status", None) == "ACTIVE"
        if is_verified and is_active:
            return

    raise ForbiddenError("Access denied: You do not have permission to view or access this property.")
