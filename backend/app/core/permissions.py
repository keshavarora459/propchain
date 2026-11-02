"""
Centralized Role-Based Access Control (RBAC) and Permissions for PropChain.
Defines roles, account statuses, functional permissions, and authorization matrix.
"""
from enum import Enum
from typing import Dict, FrozenSet, List, Set


class UserRole(str, Enum):
    """Supported user roles in the PropChain network."""
    ADMIN = "ADMIN"
    PROPERTY_OWNER = "PROPERTY_OWNER"
    BUYER = "BUYER"
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
        Permission.INITIATE_TRANSACTION,
        Permission.VERIFY_DOCUMENTS,
        Permission.REVIEW_APPROVALS,
        Permission.VIEW_FRAUD_ALERTS,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.PROPERTY_OWNER: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.REGISTER_PROPERTY,
        Permission.INITIATE_TRANSACTION,
        Permission.VIEW_PROPERTIES,
        Permission.VIEW_BLOCKCHAIN_HISTORY,
    }),
    UserRole.BUYER: frozenset({
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_PROPERTIES,
        Permission.INITIATE_TRANSACTION,
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

