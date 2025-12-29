"""
Tests for encryption service.
"""

import pytest

from app.core.encryption import (
    DecryptionError,
    EncryptionError,
    EncryptionService,
    encrypt,
    decrypt,
)


class TestEncryptionService:
    """Tests for EncryptionService class."""

    def test_encrypt_decrypt_roundtrip(self):
        """Test that encrypting and decrypting returns the original text."""
        service = EncryptionService()
        original = "my-secret-shopify-token"

        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)

        assert decrypted == original

    def test_encrypted_text_is_different(self):
        """Test that encrypted text is different from original."""
        service = EncryptionService()
        original = "my-secret-token"

        encrypted = service.encrypt(original)

        assert encrypted != original
        assert len(encrypted) > len(original)

    def test_same_input_different_output(self):
        """Test that same text encrypted twice produces different ciphertexts (due to IV)."""
        service = EncryptionService()
        original = "my-secret"

        encrypted1 = service.encrypt(original)
        encrypted2 = service.encrypt(original)

        # Fernet includes timestamp and IV, so outputs will be different
        assert encrypted1 != encrypted2

        # But both should decrypt to the same original
        assert service.decrypt(encrypted1) == original
        assert service.decrypt(encrypted2) == original

    def test_decrypt_with_invalid_token_raises_error(self):
        """Test that decrypting invalid ciphertext raises DecryptionError."""
        service = EncryptionService()

        with pytest.raises(DecryptionError) as exc_info:
            service.decrypt("invalid-token-12345")

        assert "invalid" in str(exc_info.value).lower() or "decrypt" in str(exc_info.value).lower()

    def test_encrypt_empty_string_raises_error(self):
        """Test that encrypting empty string raises ValueError."""
        service = EncryptionService()

        with pytest.raises(ValueError) as exc_info:
            service.encrypt("")

        assert "empty" in str(exc_info.value).lower()

    def test_decrypt_empty_string_raises_error(self):
        """Test that decrypting empty string raises ValueError."""
        service = EncryptionService()

        with pytest.raises(ValueError):
            service.decrypt("")

    def test_unicode_characters(self):
        """Test that encryption works with Unicode characters."""
        service = EncryptionService()
        original = "Contraseña con ñ, emojis 🔐, y 中文"

        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)

        assert decrypted == original

    def test_special_characters(self):
        """Test that encryption works with special characters."""
        service = EncryptionService()
        original = "Token!@#$%^&*()_+-={}[]|:;<>?,./"

        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)

        assert decrypted == original

    def test_long_text(self):
        """Test that encryption works with long text."""
        service = EncryptionService()
        original = "x" * 10000  # 10KB of text

        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)

        assert decrypted == original

    def test_deterministic_key_derivation(self):
        """Test that same SECRET_KEY always generates same encryption key."""
        service1 = EncryptionService()
        service2 = EncryptionService()

        original = "test-token"

        # Both services should be able to decrypt each other's ciphertexts
        encrypted_by_service1 = service1.encrypt(original)
        decrypted_by_service2 = service2.decrypt(encrypted_by_service1)

        assert decrypted_by_service2 == original

    def test_encrypt_if_not_empty_with_value(self):
        """Test encrypt_if_not_empty with non-empty value."""
        service = EncryptionService()
        result = service.encrypt_if_not_empty("test-value")

        assert result is not None
        assert service.decrypt(result) == "test-value"

    def test_encrypt_if_not_empty_with_none(self):
        """Test encrypt_if_not_empty with None."""
        service = EncryptionService()
        result = service.encrypt_if_not_empty(None)

        assert result is None

    def test_encrypt_if_not_empty_with_empty_string(self):
        """Test encrypt_if_not_empty with empty string."""
        service = EncryptionService()
        result = service.encrypt_if_not_empty("")

        assert result is None

    def test_decrypt_if_not_empty_with_value(self):
        """Test decrypt_if_not_empty with encrypted value."""
        service = EncryptionService()
        encrypted = service.encrypt("test-value")
        result = service.decrypt_if_not_empty(encrypted)

        assert result == "test-value"

    def test_decrypt_if_not_empty_with_none(self):
        """Test decrypt_if_not_empty with None."""
        service = EncryptionService()
        result = service.decrypt_if_not_empty(None)

        assert result is None

    def test_decrypt_if_not_empty_with_empty_string(self):
        """Test decrypt_if_not_empty with empty string."""
        service = EncryptionService()
        result = service.decrypt_if_not_empty("")

        assert result is None


class TestConvenienceFunctions:
    """Tests for module-level convenience functions."""

    def test_encrypt_function(self):
        """Test encrypt convenience function."""
        original = "test-token"
        encrypted = encrypt(original)

        assert encrypted != original
        assert decrypt(encrypted) == original

    def test_decrypt_function(self):
        """Test decrypt convenience function."""
        original = "test-token"
        encrypted = encrypt(original)
        decrypted = decrypt(encrypted)

        assert decrypted == original
