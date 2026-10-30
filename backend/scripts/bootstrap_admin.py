"""
Secure Administrative Bootstrap Script for PropChain.
Initializes or provisions an administrator account without hardcoded credentials.
Usage:
    python scripts/bootstrap_admin.py --email admin@propchain.network --name "Administrator" --password "SecurePass123!"
"""
import argparse
import getpass
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_session_factory
from app.core.permissions import AccountStatus, UserRole
from app.core.security import hash_password, validate_password_strength
from app.repositories.user_repository import user_repository


def bootstrap_admin():
    parser = argparse.ArgumentParser(description="PropChain Secure Admin Bootstrap Utility")
    parser.add_argument("--email", type=str, help="Admin user email address")
    parser.add_argument("--name", type=str, default="System Administrator", help="Admin display full name")
    parser.add_argument("--phone", type=str, default=None, help="Optional contact phone number")
    parser.add_argument("--password", type=str, help="Admin password (prompted interactively if omitted)")

    args = parser.parse_args()

    email = args.email
    if not email:
        email = input("Enter administrator email: ").strip()

    name = args.name
    phone = args.phone
    password = args.password

    if not password:
        password = getpass.getpass("Enter administrator password: ")
        confirm = getpass.getpass("Confirm administrator password: ")
        if password != confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    # Validate password complexity
    is_strong, err_msg = validate_password_strength(password)
    if not is_strong:
        print(f"Error: {err_msg}", file=sys.stderr)
        sys.exit(1)

    session_factory = get_session_factory()
    with session_factory() as db:
        existing = user_repository.get_by_email(db, email)
        hashed = hash_password(password)

        if existing:
            print(f"User with email '{email}' already exists.")
            if existing.role != UserRole.ADMIN.value:
                existing.role = UserRole.ADMIN.value
                existing.account_status = AccountStatus.ACTIVE.value
                existing.password_hash = hashed
                db.commit()
                print(f"Updated user '{email}' to ADMIN role and refreshed password hash.")
            else:
                existing.password_hash = hashed
                existing.account_status = AccountStatus.ACTIVE.value
                db.commit()
                print(f"Refreshed credentials for existing ADMIN '{email}'.")
        else:
            admin_user = user_repository.create_user(
                db=db,
                full_name=name,
                email=email,
                password_hash=hashed,
                phone_number=phone,
                role=UserRole.ADMIN.value,
                account_status=AccountStatus.ACTIVE.value,
                email_verified=True,
            )
            print(f"Successfully provisioned new Administrator account: {admin_user.id} ({admin_user.email})")


if __name__ == "__main__":
    bootstrap_admin()

