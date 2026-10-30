"""
Reusable Pydantic v2 Schemas for API Requests, Responses, Health, and Errors.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


def utc_now() -> datetime:
    """Return current UTC timestamp with timezone."""
    return datetime.now(timezone.utc)


class APIResponse(BaseModel, Generic[T]):
    """Standardized API envelope response schema."""
    success: bool = Field(default=True, description="Indicates operation success")
    message: str = Field(default="Operation completed successfully", description="Human-readable response message")
    data: Optional[T] = Field(default=None, description="Response payload")
    timestamp: datetime = Field(default_factory=utc_now, description="Response UTC generation timestamp")

    model_config = ConfigDict(from_attributes=True)


class ErrorDetail(BaseModel):
    """Granular error detail for form or validation errors."""
    code: str = Field(description="Error classification code")
    message: str = Field(description="Descriptive explanation of the error")
    field: Optional[str] = Field(default=None, description="Specific field name that caused the error")


class ErrorResponse(BaseModel):
    """Centralized error response returned for failures."""
    success: bool = Field(default=False, description="Always False for error responses")
    error: str = Field(description="High-level error classification or HTTP error name")
    message: str = Field(description="Safe human-readable summary of the error")
    details: Optional[List[ErrorDetail]] = Field(default=None, description="Detailed field or operational errors")
    timestamp: datetime = Field(default_factory=utc_now, description="Error generation UTC timestamp")


class HealthResponse(BaseModel):
    """API service operational health report."""
    status: str = Field(default="healthy", description="Application operational status")
    service: str = Field(default="PropChain API", description="Service identifier name")
    environment: str = Field(description="Current deployment environment")
    version: str = Field(default="0.1.0", description="API semantic version")
    timestamp: datetime = Field(default_factory=utc_now, description="Health check timestamp")


class DatabaseHealthResponse(BaseModel):
    """PostgreSQL database connectivity report."""
    status: str = Field(description="healthy or unhealthy")
    database: str = Field(description="connected or disconnected")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Safe connectivity metadata or diagnostics")
    timestamp: datetime = Field(default_factory=utc_now, description="Database check timestamp")


class PaginationMetadata(BaseModel):
    """Metadata pagination information for collections."""
    page: int = Field(default=1, ge=1, description="Current page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")
    total_items: int = Field(default=0, ge=0, description="Total count of available items")
    total_pages: int = Field(default=0, ge=0, description="Total calculated pages")
    has_next: bool = Field(default=False, description="Whether subsequent page exists")
    has_prev: bool = Field(default=False, description="Whether previous page exists")

