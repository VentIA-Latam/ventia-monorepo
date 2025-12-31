"""
Encryption service for sensitive credentials.

Uses Fernet (symmetric encryption with AES-128 in CBC mode + HMAC) to encrypt
sensitive data like Shopify access tokens.

⚠️ IMPORTANT: This is NOT for password hashing! Use bcrypt/argon2 for passwords.
This is for encrypting credentials that need to be decrypted later.
"""

import base64
import hashlib
import logging
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """Raised when encryption fails."""

    pass


class DecryptionError(Exception):
    """Raised when decryption fails."""

    pass


class EncryptionService:
    """
    Service for encrypting and decrypting sensitive credentials.

    Uses Fernet symmetric encryption with a key derived from the application's SECRET_KEY.
    """

    def __init__(self) -> None:
        """Initialize encryption service with derived key."""
        self._fernet = self._create_fernet()

    def _create_fernet(self) -> Fernet:
        """
        Create Fernet instance with key derived from SECRET_KEY.

        The key is derived using PBKDF2 to ensure it's always 32 bytes (required by Fernet).
        The same SECRET_KEY will always generate the same encryption key, allowing
        decryption of previously encrypted data.

        Returns:
            Fernet: Configured Fernet instance

        Raises:
            ValueError: If SECRET_KEY is not configured
        """
        if not settings.SECRET_KEY:
            raise ValueError("SECRET_KEY must be configured for encryption")

        # Use a fixed salt for consistent key derivation
        # This allows the same SECRET_KEY to always generate the same encryption key
        salt = b"ventia_encryption_salt_v1"

        # Derive a 32-byte key from SECRET_KEY using PBKDF2
        key_material = hashlib.pbkdf2_hmac(
            "sha256",
            settings.SECRET_KEY.encode("utf-8"),
            salt,
            iterations=100000,
            dklen=32,
        )

        # Fernet requires base64-encoded 32-byte key
        fernet_key = base64.urlsafe_b64encode(key_material)

        return Fernet(fernet_key)

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string.

        Args:
            plaintext: The text to encrypt

        Returns:
            str: Base64-encoded encrypted text

        Raises:
            EncryptionError: If encryption fails
            ValueError: If plaintext is empty

        Example:
            >>> service = EncryptionService()
            >>> encrypted = service.encrypt("my-secret-token")
            >>> print(encrypted)
            'gAAAAABf...'
        """
        if not plaintext:
            raise ValueError("Cannot encrypt empty string")

        try:
            encrypted_bytes = self._fernet.encrypt(plaintext.encode("utf-8"))
            return encrypted_bytes.decode("utf-8")

        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            raise EncryptionError(f"Failed to encrypt data: {str(e)}") from e

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt an encrypted string.

        Args:
            ciphertext: The base64-encoded encrypted text

        Returns:
            str: Decrypted plaintext

        Raises:
            DecryptionError: If decryption fails (invalid token, corrupted data, wrong key)

        Example:
            >>> service = EncryptionService()
            >>> encrypted = service.encrypt("my-secret")
            >>> decrypted = service.decrypt(encrypted)
            >>> assert decrypted == "my-secret"
        """
        if not ciphertext:
            raise ValueError("Cannot decrypt empty string")

        try:
            decrypted_bytes = self._fernet.decrypt(ciphertext.encode("utf-8"))
            return decrypted_bytes.decode("utf-8")

        except InvalidToken as e:
            logger.warning("Decryption failed: Invalid token or corrupted data")
            raise DecryptionError(
                "Failed to decrypt data. Token is invalid, corrupted, or encrypted with different key."
            ) from e

        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            raise DecryptionError(f"Failed to decrypt data: {str(e)}") from e

    def encrypt_if_not_empty(self, plaintext: Optional[str]) -> Optional[str]:
        """
        Encrypt a string only if it's not None or empty.

        Helper method for optional fields.

        Args:
            plaintext: The text to encrypt (can be None)

        Returns:
            str: Encrypted text or None if input was None/empty
        """
        if not plaintext:
            return None
        return self.encrypt(plaintext)

    def decrypt_if_not_empty(self, ciphertext: Optional[str]) -> Optional[str]:
        """
        Decrypt a string only if it's not None or empty.

        Helper method for optional fields.

        Args:
            ciphertext: The encrypted text (can be None)

        Returns:
            str: Decrypted text or None if input was None/empty
        """
        if not ciphertext:
            return None
        return self.decrypt(ciphertext)


# Singleton instance
encryption_service = EncryptionService()


# Convenience functions
def encrypt(plaintext: str) -> str:
    """
    Encrypt a plaintext string using the global encryption service.

    Args:
        plaintext: Text to encrypt

    Returns:
        str: Encrypted text
    """
    return encryption_service.encrypt(plaintext)


def decrypt(ciphertext: str) -> str:
    """
    Decrypt an encrypted string using the global encryption service.

    Args:
        ciphertext: Encrypted text to decrypt

    Returns:
        str: Decrypted text
    """
    return encryption_service.decrypt(ciphertext)
