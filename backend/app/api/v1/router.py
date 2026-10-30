"""
API v1 Central Router for PropChain.
Aggregates modular endpoint routers for the v1 API namespace.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, health, users

api_v1_router = APIRouter()

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
