"""
Webhook signature validation utilities.

Provides HMAC-SHA256 signature validation for webhooks from Shopify and WooCommerce.
Uses constant-time comparison to prevent timing attacks.
"""

import base64
import hashlib
import hmac
import logging

logger = logging.getLogger(__name__)


def verify_shopify_webhook(body: bytes, hmac_header: str, webhook_secret: str) -> bool:
    """
    Verify Shopify webhook signature.

    Shopify uses HMAC-SHA256 with base64 encoding.
    Header: X-Shopify-Hmac-Sha256

    Args:
        body: Raw request body (bytes)
        hmac_header: Value of X-Shopify-Hmac-Sha256 header
        webhook_secret: Shopify webhook secret (from tenant settings)

    Returns:
        True if signature is valid, False otherwise

    Example:
        >>> body = b'{"id": 123}'
        >>> signature = "computed_hmac_base64"
        >>> secret = "my_webhook_secret"
        >>> verify_shopify_webhook(body, signature, secret)
        True
    """
    try:
        # Compute expected signature
        computed_hmac = hmac.new(
            webhook_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        computed_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Compare signatures (constant-time comparison to prevent timing attacks)
        return hmac.compare_digest(computed_signature, hmac_header)

    except Exception as e:
        logger.error(f"Error verifying Shopify webhook signature: {str(e)}")
        return False


def verify_woocommerce_webhook(body: bytes, signature_header: str, webhook_secret: str) -> bool:
    """
    Verify WooCommerce webhook signature.

    WooCommerce uses HMAC-SHA256 with base64 encoding.
    Header: X-WC-Webhook-Signature

    Args:
        body: Raw request body (bytes)
        signature_header: Value of X-WC-Webhook-Signature header
        webhook_secret: WooCommerce webhook secret (from tenant settings)

    Returns:
        True if signature is valid, False otherwise

    Example:
        >>> body = b'{"id": 789}'
        >>> signature = "computed_hmac_base64"
        >>> secret = "my_webhook_secret"
        >>> verify_woocommerce_webhook(body, signature, secret)
        True
    """
    try:
        # Compute expected signature
        computed_hmac = hmac.new(
            webhook_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        )
        computed_signature = base64.b64encode(computed_hmac.digest()).decode("utf-8")

        # Compare signatures (constant-time comparison to prevent timing attacks)
        return hmac.compare_digest(computed_signature, signature_header)

    except Exception as e:
        logger.error(f"Error verifying WooCommerce webhook signature: {str(e)}")
        return False
