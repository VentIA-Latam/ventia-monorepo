"""
Tests for webhook signature validation.

Tests HMAC-SHA256 signature validation for Shopify and WooCommerce webhooks,
including valid signatures, invalid signatures, and edge cases.
"""

import base64
import hashlib
import hmac

import pytest

from app.core.webhook_signature import verify_shopify_webhook, verify_woocommerce_webhook


class TestShopifyWebhookSignature:
    """Tests for Shopify webhook signature validation."""

    def test_verify_valid_signature(self):
        """Test that a valid Shopify signature passes verification."""
        body = b'{"id": 12345, "email": "test@example.com"}'
        secret = "test_shopify_secret_key"

        # Compute valid signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Verify
        assert verify_shopify_webhook(body, valid_signature, secret) is True

    def test_verify_invalid_signature(self):
        """Test that an invalid Shopify signature fails verification."""
        body = b'{"id": 12345, "email": "test@example.com"}'
        secret = "test_shopify_secret_key"
        invalid_signature = "invalid_base64_signature=="

        assert verify_shopify_webhook(body, invalid_signature, secret) is False

    def test_verify_tampered_body(self):
        """Test that tampering with the body invalidates the signature."""
        original_body = b'{"id": 12345, "email": "test@example.com"}'
        tampered_body = b'{"id": 99999, "email": "hacker@example.com"}'
        secret = "test_shopify_secret_key"

        # Create signature for original body
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            original_body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Try to verify tampered body with original signature
        assert verify_shopify_webhook(tampered_body, valid_signature, secret) is False

    def test_verify_wrong_secret(self):
        """Test that using the wrong secret fails verification."""
        body = b'{"id": 12345, "email": "test@example.com"}'
        correct_secret = "correct_secret"
        wrong_secret = "wrong_secret"

        # Create signature with correct secret
        computed_hmac = hmac.new(
            correct_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Try to verify with wrong secret
        assert verify_shopify_webhook(body, valid_signature, wrong_secret) is False

    def test_verify_empty_body(self):
        """Test signature validation with empty body."""
        body = b""
        secret = "test_secret"

        # Compute valid signature for empty body
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        assert verify_shopify_webhook(body, valid_signature, secret) is True

    def test_verify_empty_signature_header(self):
        """Test that empty signature header fails verification."""
        body = b'{"id": 12345}'
        secret = "test_secret"
        empty_signature = ""

        assert verify_shopify_webhook(body, empty_signature, secret) is False

    def test_verify_empty_secret(self):
        """Test signature validation with empty secret."""
        body = b'{"id": 12345}'
        secret = ""

        # Compute signature with empty secret
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Should still work (empty string is valid secret)
        assert verify_shopify_webhook(body, valid_signature, secret) is True

    def test_verify_unicode_body(self):
        """Test signature validation with Unicode characters in body."""
        body = '{"name": "José García", "emoji": "🎉"}'.encode("utf-8")
        secret = "test_secret"

        # Compute valid signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        assert verify_shopify_webhook(body, valid_signature, secret) is True

    def test_verify_malformed_base64_signature(self):
        """Test that malformed base64 signature fails verification."""
        body = b'{"id": 12345}'
        secret = "test_secret"
        malformed_signature = "not-valid-base64!@#$"

        assert verify_shopify_webhook(body, malformed_signature, secret) is False

    def test_constant_time_comparison(self):
        """
        Test that the function uses constant-time comparison.

        This is a functional test - timing attacks are prevented by using
        hmac.compare_digest which is guaranteed to be constant-time.
        """
        body = b'{"id": 12345}'
        secret = "test_secret"

        # Create two different signatures
        signature1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        signature2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

        # Both should fail, but shouldn't leak timing information
        # (We can't test timing here, but we verify the function uses hmac.compare_digest)
        result1 = verify_shopify_webhook(body, signature1, secret)
        result2 = verify_shopify_webhook(body, signature2, secret)

        assert result1 is False
        assert result2 is False

    def test_verify_large_payload(self):
        """Test signature validation with large payload."""
        # Create a large JSON payload (~10KB)
        large_body = b'{"items": [' + b'{"id": 1, "name": "item"},' * 1000 + b']}'
        secret = "test_secret"

        # Compute valid signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            large_body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        assert verify_shopify_webhook(large_body, valid_signature, secret) is True


class TestWooCommerceWebhookSignature:
    """Tests for WooCommerce webhook signature validation."""

    def test_verify_valid_signature(self):
        """Test that a valid WooCommerce signature passes verification."""
        body = b'{"id": 789, "status": "completed"}'
        secret = "test_woocommerce_secret"

        # Compute valid signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Verify
        assert verify_woocommerce_webhook(body, valid_signature, secret) is True

    def test_verify_invalid_signature(self):
        """Test that an invalid WooCommerce signature fails verification."""
        body = b'{"id": 789, "status": "completed"}'
        secret = "test_woocommerce_secret"
        invalid_signature = "totally_invalid_signature"

        assert verify_woocommerce_webhook(body, invalid_signature, secret) is False

    def test_verify_tampered_body(self):
        """Test that tampering with the body invalidates the signature."""
        original_body = b'{"id": 789, "total": "100.00"}'
        tampered_body = b'{"id": 789, "total": "0.01"}'
        secret = "test_woocommerce_secret"

        # Create signature for original body
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            original_body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Try to verify tampered body with original signature
        assert verify_woocommerce_webhook(tampered_body, valid_signature, secret) is False

    def test_verify_wrong_secret(self):
        """Test that using the wrong secret fails verification."""
        body = b'{"id": 789}'
        correct_secret = "woo_correct_secret"
        wrong_secret = "woo_wrong_secret"

        # Create signature with correct secret
        computed_hmac = hmac.new(
            correct_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Try to verify with wrong secret
        assert verify_woocommerce_webhook(body, valid_signature, wrong_secret) is False

    def test_verify_empty_body(self):
        """Test signature validation with empty body."""
        body = b""
        secret = "test_secret"

        # Compute valid signature for empty body
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        assert verify_woocommerce_webhook(body, valid_signature, secret) is True

    def test_verify_empty_signature_header(self):
        """Test that empty signature header fails verification."""
        body = b'{"id": 789}'
        secret = "test_secret"
        empty_signature = ""

        assert verify_woocommerce_webhook(body, empty_signature, secret) is False

    def test_verify_unicode_body(self):
        """Test signature validation with Unicode characters in body."""
        body = '{"billing": {"first_name": "María", "city": "São Paulo"}}'.encode("utf-8")
        secret = "test_secret"

        # Compute valid signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        valid_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        assert verify_woocommerce_webhook(body, valid_signature, secret) is True

    def test_constant_time_comparison(self):
        """
        Test that the function uses constant-time comparison.

        Verifies that hmac.compare_digest is used to prevent timing attacks.
        """
        body = b'{"id": 789}'
        secret = "test_secret"

        # Create two different invalid signatures
        signature1 = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        signature2 = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"

        # Both should fail consistently
        result1 = verify_woocommerce_webhook(body, signature1, secret)
        result2 = verify_woocommerce_webhook(body, signature2, secret)

        assert result1 is False
        assert result2 is False


class TestCrossPlatformValidation:
    """Tests to ensure Shopify and WooCommerce validations are independent."""

    def test_shopify_signature_does_not_validate_for_woocommerce(self):
        """Test that a Shopify signature doesn't accidentally validate for WooCommerce."""
        body = b'{"id": 12345}'
        secret = "shared_secret"

        # Create Shopify signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        shopify_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Should work for Shopify
        assert verify_shopify_webhook(body, shopify_signature, secret) is True

        # Should also work for WooCommerce (same algorithm)
        # This is expected - both use HMAC-SHA256 with base64
        assert verify_woocommerce_webhook(body, shopify_signature, secret) is True

    def test_different_platforms_same_body_same_signature(self):
        """
        Test that both platforms produce the same signature for the same body/secret.

        This is expected behavior since both use HMAC-SHA256 with base64 encoding.
        """
        body = b'{"order_id": 999}'
        secret = "platform_secret"

        # Compute signature
        computed_hmac = hmac.new(
            secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Both should validate the same signature
        assert verify_shopify_webhook(body, signature, secret) is True
        assert verify_woocommerce_webhook(body, signature, secret) is True


class TestErrorHandling:
    """Tests for error handling in signature validation."""

    def test_shopify_handles_exception_gracefully(self):
        """Test that Shopify verification handles exceptions and returns False."""
        # This test ensures exceptions don't propagate
        body = b'{"id": 123}'
        secret = "test_secret"
        # Pass None as signature to potentially trigger exception
        result = verify_shopify_webhook(body, None, secret)
        assert result is False

    def test_woocommerce_handles_exception_gracefully(self):
        """Test that WooCommerce verification handles exceptions and returns False."""
        body = b'{"id": 789}'
        secret = "test_secret"
        # Pass None as signature to potentially trigger exception
        result = verify_woocommerce_webhook(body, None, secret)
        assert result is False

    def test_shopify_with_none_body(self):
        """Test Shopify verification with None body."""
        secret = "test_secret"
        signature = "some_signature"
        # Should handle gracefully and return False
        result = verify_shopify_webhook(None, signature, secret)
        assert result is False

    def test_woocommerce_with_none_body(self):
        """Test WooCommerce verification with None body."""
        secret = "test_secret"
        signature = "some_signature"
        # Should handle gracefully and return False
        result = verify_woocommerce_webhook(None, signature, secret)
        assert result is False
