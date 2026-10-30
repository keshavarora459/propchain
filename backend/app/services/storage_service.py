"""
Secure Document Storage and Encryption Service for PropChain.
Safeguards confidential deed and identity documents using AES-GCM / Fernet encryption at rest.
"""
import base64
import hashlib
import os
import uuid
from pathlib import Path
from typing import Tuple

from cryptography.fernet import Fernet

from app.core.config import get_settings


class StorageService:
    def __init__(self):
        settings = get_settings()
        # Resolve storage directory outside web root
        repo_root = Path(__file__).resolve().parent.parent.parent.parent
        self.storage_dir = repo_root / "storage" / "uploads" / "documents"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Derive 32-byte url-safe base64 key from settings or secret
        raw_key = os.getenv("DOCUMENT_ENCRYPTION_KEY")
        if not raw_key:
            # Deterministic derivation from JWT secret
            digest = hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest()
            self._fernet = Fernet(base64.urlsafe_b64encode(digest))
        else:
            self._fernet = Fernet(raw_key.encode() if isinstance(raw_key, str) else raw_key)

    def save_file(self, content: bytes, original_filename: str, encrypt: bool = True) -> Tuple[str, str, int]:
        """
        Calculates SHA-256 hash on original bytes, optionally encrypts file,
        and saves to disk with an unguessable UUID filename.
        Returns: (storage_path, sha256_hash, original_file_size)
        """
        # 1. Compute SHA-256 hash of original unencrypted bytes
        sha256_hash = hashlib.sha256(content).hexdigest()
        file_size = len(content)

        # 2. Encrypt content if requested
        data_to_write = self._fernet.encrypt(content) if encrypt else content

        # 3. Generate secure server-side path
        file_ext = Path(original_filename).suffix.lower() or ".bin"
        filename = f"{uuid.uuid4().hex}{file_ext}{'.enc' if encrypt else ''}"
        destination = self.storage_dir / filename

        destination.write_bytes(data_to_write)
        return str(destination), sha256_hash, file_size

    def read_file(self, storage_path: str, is_encrypted: bool = True) -> bytes:
        """Reads file from disk and decrypts if encrypted."""
        file_path = Path(storage_path)
        if not file_path.is_file():
            raise FileNotFoundError(f"Stored file not found at: {storage_path}")

        raw_data = file_path.read_bytes()
        if is_encrypted:
            return self._fernet.decrypt(raw_data)
        return raw_data

