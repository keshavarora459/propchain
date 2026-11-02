"""
Centralized Configuration Management for PropChain Backend.
Utilizes Pydantic Settings v2 to load, validate, and manage environment configuration.
"""
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, List
from urllib.parse import urlparse, urlunparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Determine project root and potential .env locations
_CORE_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CORE_DIR.parent.parent
_REPO_ROOT = _BACKEND_DIR.parent

# Select active .env file: checks backend/.env first, then root .env
_ENV_FILE = None
if (_BACKEND_DIR / ".env").is_file():
    _ENV_FILE = _BACKEND_DIR / ".env"
elif (_REPO_ROOT / ".env").is_file():
    _ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    """Application configuration and environment variables."""

    # Application settings
    APP_NAME: str = Field(default="PropChain API", description="Name of the application")
    APP_ENV: str = Field(default="development", description="Environment: development, test, staging, production")
    DEBUG: bool = Field(default=True, description="Enable debug mode")
    API_V1_STR: str = Field(default="/api/v1", description="Prefix for API version 1")

    # Network / Server settings
    BACKEND_HOST: str = Field(default="127.0.0.1", description="Backend bind host")
    BACKEND_PORT: int = Field(default=8000, description="Backend bind port")

    # Frontend integration
    FRONTEND_URL: str = Field(default="http://localhost:5173", description="Allowed frontend origin URL")
    ADDITIONAL_ALLOWED_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        description="Secondary allowed CORS origins",
    )

    # Database configuration (Ephemeral in-memory cache, MongoDB Atlas is persistent store)
    DATABASE_URL: str = Field(
        default="sqlite:///:memory:",
        description="SQLAlchemy database connection URL",
    )
    DATABASE_POOL_SIZE: int = Field(default=5, ge=1, le=50, description="SQLAlchemy connection pool size")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, ge=0, le=50, description="Max overflow connections")
    DATABASE_POOL_TIMEOUT: int = Field(default=30, ge=1, le=120, description="Connection pool timeout in seconds")
    DATABASE_POOL_RECYCLE: int = Field(default=1800, ge=60, description="Recycle connections after N seconds")

    # MongoDB Atlas Configuration
    MONGODB_USERNAME: str = Field(default="", description="MongoDB Atlas username")
    MONGODB_PASSWORD: str = Field(default="", description="MongoDB Atlas password")
    MONGODB_URI: str = Field(
        default="",
        description="MongoDB connection URI",
    )
    MONGODB_DB_NAME: str = Field(default="propchain", description="MongoDB database name")

    # Logging infrastructure
    LOG_LEVEL: str = Field(default="INFO", description="Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL")
    LOG_DIR: str = Field(default="logs", description="Directory to store rotating log files")
    LOG_ROTATION_BYTES: int = Field(default=10 * 1024 * 1024, description="Max log file size in bytes (10MB)")
    LOG_BACKUP_COUNT: int = Field(default=5, description="Number of rotating log backups to retain")

    # Security & JWT Authentication
    JWT_SECRET_KEY: str = Field(
        default="propchain_phase4_super_secret_signing_key_replace_in_production",
        description="HMAC secret key used for JWT signing",
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT digital signature algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=15, ge=1, le=1440, description="Access token lifespan in minutes")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, ge=1, le=90, description="Refresh token lifespan in days")
    JWT_ISSUER: str = Field(default="propchain", description="JWT token issuer claim")
    JWT_AUDIENCE: str = Field(default="propchain-api", description="JWT token audience claim")

    # Cookie Security Settings
    COOKIE_SECURE: bool = Field(default=False, description="Set Secure flag on cookies (must be True in production HTTPS)")
    COOKIE_SAMESITE: str = Field(default="lax", description="SameSite cookie policy: lax, strict, none")
    REFRESH_COOKIE_NAME: str = Field(default="propchain_refresh_token", description="Name of HTTP-only refresh cookie")

    # Brute Force Rate Limiting
    LOGIN_MAX_FAILED_ATTEMPTS: int = Field(default=5, ge=3, le=20, description="Max consecutive failed logins before lockout")
    LOGIN_LOCKOUT_MINUTES: int = Field(default=15, ge=1, le=120, description="Duration in minutes to lockout an account")

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v: Any) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            clean = v.strip().lower()
            if clean in {"true", "1", "yes", "t", "debug", "on"}:
                return True
            if clean in {"false", "0", "no", "f", "release", "off"}:
                return False
        return False

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper_v = v.upper()
        if upper_v not in valid_levels:
            raise ValueError(f"LOG_LEVEL must be one of {valid_levels}, got '{v}'")
        return upper_v

    @field_validator("APP_ENV")
    @classmethod
    def validate_app_env(cls, v: str) -> str:
        valid_envs = {"development", "test", "testing", "staging", "production"}
        lower_v = v.lower()
        if lower_v not in valid_envs:
            raise ValueError(f"APP_ENV must be one of {valid_envs}, got '{v}'")
        return lower_v

    @property
    def is_development(self) -> bool:
        """Return True if running in development mode."""
        return self.APP_ENV in {"development", "test", "testing"}

    @property
    def cors_origins(self) -> List[str]:
        """Aggregate all unique allowed CORS origins."""
        origins = [self.FRONTEND_URL] + self.ADDITIONAL_ALLOWED_ORIGINS
        # deduplicate while preserving order
        seen = set()
        deduped = []
        for o in origins:
            cleaned = o.strip().rstrip("/")
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                deduped.append(cleaned)
        return deduped

    @property
    def sanitized_database_url(self) -> str:
        """
        Return the database URL with the password redacted for safe logging
        and API responses. Never exposes credentials.
        """
        try:
            parsed = urlparse(self.DATABASE_URL)
            if not parsed.netloc:
                return "sqlite:///:memory:" if "sqlite" in self.DATABASE_URL else "configured"

            # Redact password if present in userinfo
            if parsed.password:
                netloc = f"{parsed.username}:***@{parsed.hostname}"
                if parsed.port:
                    netloc += f":{parsed.port}"
                return urlunparse((
                    parsed.scheme,
                    netloc,
                    parsed.path,
                    parsed.params,
                    parsed.query,
                    parsed.fragment,
                ))
            return self.DATABASE_URL
        except Exception:
            return "postgresql+psycopg://***"


@lru_cache()
def get_settings() -> Settings:
    """Return cached singleton instance of application settings."""
    return Settings()
