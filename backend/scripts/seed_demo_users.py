"""
Demo Users Seeding Script for PropChain Local Development.
Provisions one user for each core platform role with a standard development password.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import get_engine, get_session_factory
from app.core.permissions import AccountStatus, UserRole
from app.core.security import hash_password
from app.models.base import Base
import app.models
from app.repositories.user_repository import user_repository
from app.core.mongo import check_mongo_connection, hydrate_all_from_mongo

DEFAULT_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "Password123!")

DEMO_ACCOUNTS = [
    {
        "full_name": "System Administrator",
        "email": "admin@propchain.network",
        "role": UserRole.ADMIN.value,
    },
    {
        "full_name": "Chief Land Registrar",
        "email": "legal@propchain.network",
        "role": UserRole.LEGAL_AUTHORITY.value,
    },
    {
        "full_name": "Senior Title Registrar",
        "email": "verifier@propchain.network",
        "role": UserRole.REGISTRAR.value,
    },
    {
        "full_name": "Alice Seller (Owner)",
        "email": "seller@propchain.network",
        "role": UserRole.PROPERTY_OWNER.value,
    },
    {
        "full_name": "Bob Buyer",
        "email": "buyer@propchain.network",
        "role": UserRole.BUYER.value,
    },
]


def seed_demo_users():
    print("=" * 60)
    print("PropChain Demo Accounts Provisioning")
    print("=" * 60)
    print(f"Default Development Password: {DEFAULT_PASSWORD}\n")

    # Ensure tables exist
    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    session_factory = get_session_factory()
    hashed = hash_password(DEFAULT_PASSWORD)

    with session_factory() as db:
        # Attempt hydration from Mongo first
        mongo_ok, _, _ = check_mongo_connection()
        if mongo_ok:
            try:
                hydrate_all_from_mongo(db)
            except Exception as e:
                db.rollback()
                print(f"Mongo hydration notice: {e}")

        for acc in DEMO_ACCOUNTS:
            email = acc["email"]
            existing = user_repository.get_by_email(db, email)
            if existing:
                existing.role = acc["role"]
                existing.account_status = AccountStatus.ACTIVE.value
                existing.password_hash = hashed
                existing.full_name = acc["full_name"]
                db.commit()
                print(f"[UPDATED] {acc['role']:<18} | {email:<28} | Password: {DEFAULT_PASSWORD}")
            else:
                user = user_repository.create_user(
                    db=db,
                    full_name=acc["full_name"],
                    email=email,
                    password_hash=hashed,
                    role=acc["role"],
                    account_status=AccountStatus.ACTIVE.value,
                    email_verified=True,
                )
                print(f"[CREATED] {acc['role']:<18} | {email:<28} | Password: {DEFAULT_PASSWORD}")

    print("\n" + "=" * 60)
    print("All demo accounts are ready for authentication testing!")
    print("=" * 60)


if __name__ == "__main__":
    seed_demo_users()
