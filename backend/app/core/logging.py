"""
Centralized Logging Infrastructure for PropChain Backend.
Provides structured, rotating, bounded logging with security redaction.
"""
import logging
import re
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from app.core.config import get_settings


# Sensitive patterns that should never leak into log files
SENSITIVE_PATTERNS = [
    (re.compile(r'(password[:=]\s*["\']?)([^"\'\s]+)(["\']?)', re.IGNORECASE), r'\1***\3'),
    (re.compile(r'(secret[:=]\s*["\']?)([^"\'\s]+)(["\']?)', re.IGNORECASE), r'\1***\3'),
    (re.compile(r'(token[:=]\s*["\']?)([^"\'\s]+)(["\']?)', re.IGNORECASE), r'\1***\3'),
    (re.compile(r'(private_key[:=]\s*["\']?)([^"\'\s]+)(["\']?)', re.IGNORECASE), r'\1***\3'),
    (re.compile(r'(authorization[:=]\s*Bearer\s+)([A-Za-z0-9_\-\.]+)', re.IGNORECASE), r'\1***'),
    (re.compile(r'(://[^:]+:)([^@]+)(@)', re.IGNORECASE), r'\1***\3'),  # mask database password in URLs
]


class SensitiveDataFilter(logging.Filter):
    """Filter that masks sensitive credentials in log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self._sanitize(record.msg)
        if record.args:
            if isinstance(record.args, tuple):
                record.args = tuple(
                    self._sanitize(str(a)) if isinstance(a, str) else a for a in record.args
                )
            elif isinstance(record.args, dict):
                record.args = {
                    k: self._sanitize(str(v)) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
        return True

    def _sanitize(self, message: str) -> str:
        for pattern, replacement in SENSITIVE_PATTERNS:
            message = pattern.sub(replacement, message)
        return message


_LOGGING_INITIALIZED = False


def setup_logging() -> None:
    """Initialize structured logging handlers, formatting, and rotation."""
    global _LOGGING_INITIALIZED
    if _LOGGING_INITIALIZED:
        return

    settings = get_settings()

    # Determine log directory
    log_dir_path = Path(settings.LOG_DIR)
    if not log_dir_path.is_absolute():
        backend_root = Path(__file__).resolve().parent.parent.parent
        log_dir_path = backend_root / settings.LOG_DIR

    log_dir_path.mkdir(parents=True, exist_ok=True)
    log_file_path = log_dir_path / "propchain.log"

    # Define standard format
    log_format = logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(name)s:%(funcName)s:%(lineno)d] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    log_filter = SensitiveDataFilter()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_format)
    console_handler.addFilter(log_filter)

    # Rotating file handler (bounded at 10MB per file, 5 backups by default)
    file_handler = RotatingFileHandler(
        filename=str(log_file_path),
        maxBytes=settings.LOG_ROTATION_BYTES,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(log_format)
    file_handler.addFilter(log_filter)

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    # Adjust external noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    _LOGGING_INITIALIZED = True


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Get a named logger configured with PropChain logging settings."""
    if not _LOGGING_INITIALIZED:
        setup_logging()
    return logging.getLogger(name or "propchain")

