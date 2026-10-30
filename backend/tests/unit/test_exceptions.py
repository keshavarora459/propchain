"""
Unit tests for PropChain Exception Handling.
"""
from app.core.exceptions import (
    PropChainException,
    DatabaseConnectionException,
    ResourceNotFoundException,
    ValidationException,
)
from app.schemas.common import ErrorDetail


def test_propchain_exception_defaults():
    """Verify base application exception attributes."""
    exc = PropChainException(message="A custom business rule failed", status_code=400)
    assert exc.message == "A custom business rule failed"
    assert exc.status_code == 400


def test_database_connection_exception_status():
    """Verify DatabaseConnectionException maps to 503."""
    exc = DatabaseConnectionException()
    assert exc.status_code == 503
    assert "Database connection" in exc.message


def test_resource_not_found_exception_status():
    """Verify ResourceNotFoundException maps to 404."""
    exc = ResourceNotFoundException(message="Property title deed not found.")
    assert exc.status_code == 404
    assert exc.message == "Property title deed not found."


def test_validation_exception_with_details():
    """Verify ValidationException attaches granular details."""
    detail = ErrorDetail(code="invalid_uuid", message="Malformed UUID", field="id")
    exc = ValidationException(message="Validation failed", details=[detail])
    assert exc.status_code == 422
    assert len(exc.details) == 1
    assert exc.details[0].code == "invalid_uuid"

