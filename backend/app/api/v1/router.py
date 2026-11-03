"""
API v1 Central Router for PropChain.
Aggregates modular endpoint routers for the v1 API namespace.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    approvals,
    auth,
    blockchain,
    documents,
    health,
    ownership,
    properties,
    transactions,
    users,
    wallet,
)

api_v1_router = APIRouter()

# Mount blockchain telemetry & decentralized ledger router
api_v1_router.include_router(
    blockchain.router,
    tags=["Blockchain"],
)

# Mount analytics router
api_v1_router.include_router(
    analytics.router,
    tags=["Analytics"],
)

# Mount health diagnostics router
api_v1_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"],
)

# Mount authentication router
api_v1_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)

# Mount user management and profile router
api_v1_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"],
)

# Mount property management router
api_v1_router.include_router(
    properties.router,
    tags=["Properties"],
)

# Mount document management & verification router
api_v1_router.include_router(
    documents.router,
    tags=["Documents"],
)

# Mount wallet verification & linking router
api_v1_router.include_router(
    wallet.router,
    tags=["Wallet"],
)

# Mount ownership & blockchain history router
api_v1_router.include_router(
    ownership.router,
    tags=["Ownership"],
)

# Mount property transaction router
api_v1_router.include_router(
    transactions.router,
    tags=["Transactions"],
)

# Mount stakeholder approvals router
api_v1_router.include_router(
    approvals.router,
    tags=["Approvals"],
)
