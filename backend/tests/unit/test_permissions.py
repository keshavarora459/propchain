"""
Unit tests for PropChain Role-Based Access Control and Permission Matrix.
"""
from app.core.permissions import (
    Permission,
    ROLE_PERMISSIONS,
    UserRole,
    get_role_permissions,
    has_permission,
)


def test_admin_permissions():
    """Verify Admin has broad operational permissions but strictly NOT legal registration."""
    # Admin can manage users and view dashboard
    assert has_permission(UserRole.ADMIN, Permission.MANAGE_USERS) is True
    assert has_permission(UserRole.ADMIN, Permission.VIEW_DASHBOARD) is True
    assert has_permission(UserRole.ADMIN, Permission.REGISTER_PROPERTY) is True
    assert has_permission(UserRole.ADMIN, Permission.VIEW_FRAUD_ALERTS) is True

    # CRITICAL: Admin must NOT be able to confirm legal registration
    assert has_permission(UserRole.ADMIN, Permission.CONFIRM_LEGAL_REGISTRATION) is False


def test_legal_authority_permissions():
    """Verify Legal Authority has confirmation rights."""
    assert has_permission(UserRole.LEGAL_AUTHORITY, Permission.CONFIRM_LEGAL_REGISTRATION) is True
    assert has_permission(UserRole.LEGAL_AUTHORITY, Permission.REVIEW_APPROVALS) is True
    assert has_permission(UserRole.LEGAL_AUTHORITY, Permission.MANAGE_USERS) is False


def test_buyer_and_owner_permissions():
    """Verify Buyer and Owner roles enforce separation of privileges."""
    # Buyer can initiate transactions, Owner cannot
    assert has_permission(UserRole.BUYER, Permission.INITIATE_TRANSACTION) is True
    assert has_permission(UserRole.PROPERTY_OWNER, Permission.INITIATE_TRANSACTION) is False

    # Owner can register property, Buyer cannot
    assert has_permission(UserRole.PROPERTY_OWNER, Permission.REGISTER_PROPERTY) is True
    assert has_permission(UserRole.BUYER, Permission.REGISTER_PROPERTY) is False

    # Neither can manage users or confirm legal registration
    assert has_permission(UserRole.BUYER, Permission.MANAGE_USERS) is False
    assert has_permission(UserRole.PROPERTY_OWNER, Permission.MANAGE_USERS) is False


def test_get_role_permissions_list():
    """Verify get_role_permissions returns string identifiers matching matrix."""
    perms = get_role_permissions(UserRole.VERIFIER)
    assert Permission.VERIFY_DOCUMENTS.value in perms
    assert Permission.REVIEW_APPROVALS.value in perms
    assert Permission.MANAGE_USERS.value not in perms

