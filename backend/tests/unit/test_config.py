"""
Unit tests for PropChain Configuration Management.
"""
import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_settings_defaults():
    """Verify default configuration values."""
    settings = Settings(DATABASE_URL="postgresql+psycopg://test:pass@localhost:5432/testdb")
    assert settings.APP_NAME == "PropChain API"
    assert settings.BACKEND_HOST == "127.0.0.1"
    assert settings.BACKEND_PORT == 8000
    assert settings.DATABASE_POOL_SIZE == 5
    assert settings.DATABASE_MAX_OVERFLOW == 10
    assert settings.DATABASE_POOL_TIMEOUT == 30
    assert settings.DATABASE_POOL_RECYCLE == 1800


def test_sanitized_database_url_redacts_password():
    """Verify database password is never exposed in sanitized URL."""
    settings = Settings(DATABASE_URL="postgresql+psycopg://myuser:supersecret123@dbhost:5432/prochain")
    sanitized = settings.sanitized_database_url
    assert "supersecret123" not in sanitized
    assert "myuser:***@dbhost:5432/prochain" in sanitized


def test_invalid_log_level_raises_validation_error():
    """Verify invalid LOG_LEVEL is rejected by validator."""
    with pytest.raises(ValidationError):
        Settings(LOG_LEVEL="INVALID_LEVEL")


def test_invalid_app_env_raises_validation_error():
    """Verify invalid APP_ENV is rejected by validator."""
    with pytest.raises(ValidationError):
        Settings(APP_ENV="unknown_environment")


def test_cors_origins_aggregation():
    """Verify CORS origins aggregation and deduplication."""
    settings = Settings(
        FRONTEND_URL="http://localhost:5173",
        ADDITIONAL_ALLOWED_ORIGINS=["http://localhost:5173", "http://127.0.0.1:5173"],
    )
    origins = settings.cors_origins
    assert len(origins) == 2
    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins

