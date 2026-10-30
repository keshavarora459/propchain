"""
Unit tests for PropChain Pydantic v2 schemas.
"""
from datetime import datetime, timezone
import pytest
from pydantic import ValidationError

from app.schemas.common import (
    APIResponse,
    DatabaseHealthResponse,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
    PaginationMetadata,
)


def test_health_response_valid():
    """Verify HealthResponse schema structure."""
    resp = HealthResponse(
        status="healthy",
        service="PropChain API",
        environment="development",
        version="0.1.0",
    )
    assert resp.status == "healthy"
    assert resp.service == "PropChain API"
    assert isinstance(resp.timestamp, datetime)


def test_database_health_response():
    """Verify DatabaseHealthResponse schema structure."""
    resp = DatabaseHealthResponse(
        status="healthy",
        database="connected",
        details={"version": "PostgreSQL 15"},
    )
    assert resp.status == "healthy"
    assert resp.database == "connected"
    assert resp.details["version"] == "PostgreSQL 15"


def test_api_response_envelope():
    """Verify generic APIResponse envelope serialization."""
    payload = {"key": "value"}
    resp = APIResponse[dict](success=True, message="Success", data=payload)
    data = resp.model_dump(mode="json")
    assert data["success"] is True
    assert data["message"] == "Success"
    assert data["data"] == payload
    assert "timestamp" in data


def test_error_response_with_details():
    """Verify ErrorResponse schema with nested ErrorDetail list."""
    details = [ErrorDetail(code="required_field", message="Field cannot be blank", field="title")]
    err = ErrorResponse(
        error="ValidationError",
        message="Invalid form inputs",
        details=details,
    )
    assert err.success is False
    assert err.error == "ValidationError"
    assert len(err.details) == 1
    assert err.details[0].field == "title"


def test_pagination_metadata_validation():
    """Verify PaginationMetadata validation constraints."""
    meta = PaginationMetadata(
        page=2,
        page_size=25,
        total_items=100,
        total_pages=4,
        has_next=True,
        has_prev=True,
    )
    assert meta.page == 2
    assert meta.has_next is True

    # Page cannot be negative or zero
    with pytest.raises(ValidationError):
        PaginationMetadata(page=0, page_size=20)

