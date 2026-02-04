"""
Tenant settings schemas for e-commerce platform configuration.

These schemas define the structure for the `settings` JSON field in the Tenant model,
providing typed configuration for multiple e-commerce platforms (Shopify, WooCommerce).
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ShopifyCredentials(BaseModel):
    """
    Shopify store credentials for OAuth2 API integration.

    These credentials are used to authenticate with the Shopify Admin GraphQL API
    for operations like completing draft orders. The system uses OAuth2 client credentials
    to automatically generate and refresh access tokens.

    Attributes:
        store_url: Full URL of the Shopify store (e.g., 'https://my-store.myshopify.com')
        api_version: Shopify API version to use (e.g., '2025-10')
        client_id: OAuth2 client ID (sensitive, will be encrypted at rest)
        client_secret: OAuth2 client secret (sensitive, will be encrypted at rest)
        access_token: Shopify Admin API access token (auto-generated, encrypted at rest)
        access_token_expires_at: UTC timestamp when the access token expires
    """

    store_url: str = Field(
        ...,
        description="Shopify store URL (e.g., 'https://my-store.myshopify.com')",
    )
    api_version: str = Field(
        default="2025-10",
        description="Shopify API version (e.g., '2025-10')",
    )

    # OAuth2 credentials (nuevos)
    client_id: str | None = Field(
        None,
        description="Shopify OAuth2 client ID (sensitive - encrypted at rest)",
    )
    client_secret: str | None = Field(
        None,
        description="Shopify OAuth2 client secret (sensitive - encrypted at rest)",
    )

    # Managed access token (auto-renewed)
    access_token: str | None = Field(
        None,
        description="Shopify Admin API access token (auto-generated and renewed, encrypted at rest)",
    )
    access_token_expires_at: datetime | None = Field(
        None,
        description="UTC timestamp when the access token expires",
    )

    # Webhook configuration
    webhook_secret: str | None = Field(
        None,
        description="Secret for webhook HMAC signature validation (auto-generated if not provided, encrypted at rest)",
    )

    @field_validator("store_url")
    @classmethod
    def validate_store_url(cls, v: str) -> str:
        """Validate that store URL is a valid HTTPS URL."""
        if not v:
            raise ValueError("Store URL is required")
        if not v.startswith(("http://", "https://")):
            raise ValueError("Store URL must start with http:// or https://")
        return v.rstrip("/")


class WooCommerceCredentials(BaseModel):
    """
    WooCommerce store credentials for REST API integration.

    These credentials are used to authenticate with the WooCommerce REST API
    using HTTP Basic Auth for operations like marking orders as paid.

    Attributes:
        store_url: Full URL of the WooCommerce store (e.g., 'https://my-store.com')
        consumer_key: WooCommerce REST API consumer key (sensitive, will be encrypted)
        consumer_secret: WooCommerce REST API consumer secret (sensitive, will be encrypted)
    """

    store_url: str = Field(
        ...,
        description="WooCommerce store URL (e.g., 'https://my-store.com')",
    )
    consumer_key: str | None = Field(
        None,
        description="WooCommerce REST API consumer key (sensitive - encrypted at rest)",
    )
    consumer_secret: str | None = Field(
        None,
        description="WooCommerce REST API consumer secret (sensitive - encrypted at rest)",
    )
    webhook_secret: str | None = Field(
        None,
        description="Secret for webhook HMAC signature validation (auto-generated if not provided, encrypted at rest)",
    )

    @field_validator("store_url")
    @classmethod
    def validate_store_url(cls, v: str) -> str:
        """Validate that store URL is a valid HTTPS URL."""
        if not v:
            raise ValueError("Store URL is required")
        if not v.startswith(("http://", "https://")):
            raise ValueError("Store URL must start with http:// or https://")
        return v.rstrip("/")


class EcommerceSettings(BaseModel):
    """
    Unified e-commerce platform configuration.

    This schema supports multiple e-commerce platforms but enforces that only one
    platform can be configured at a time. It provides properties to easily determine
    which platform is active.

    Attributes:
        sync_on_validation: Whether to sync order status to e-commerce platform when
                           payment is validated (default: True)
        shopify: Shopify credentials if using Shopify platform
        woocommerce: WooCommerce credentials if using WooCommerce platform

    Properties:
        platform: Returns 'shopify', 'woocommerce', or None based on configuration
        has_ecommerce: Returns True if any e-commerce platform is configured
    """

    sync_on_validation: bool = Field(
        default=True,
        description="Sync order status to e-commerce platform when payment is validated",
    )
    shopify: ShopifyCredentials | None = Field(
        None,
        description="Shopify platform credentials (mutually exclusive with woocommerce)",
    )
    woocommerce: WooCommerceCredentials | None = Field(
        None,
        description="WooCommerce platform credentials (mutually exclusive with shopify)",
    )

    @model_validator(mode="after")
    def validate_single_platform(self) -> "EcommerceSettings":
        """
        Ensure only one e-commerce platform is configured at a time.

        Raises:
            ValueError: If both Shopify and WooCommerce are configured simultaneously.
        """
        if self.shopify is not None and self.woocommerce is not None:
            raise ValueError(
                "Only one e-commerce platform can be configured at a time. "
                "Please configure either Shopify or WooCommerce, not both."
            )
        return self

    @property
    def platform(self) -> Literal["shopify", "woocommerce"] | None:
        """
        Get the currently configured e-commerce platform.

        Returns:
            'shopify' if Shopify is configured,
            'woocommerce' if WooCommerce is configured,
            None if no platform is configured.
        """
        if self.shopify is not None:
            return "shopify"
        if self.woocommerce is not None:
            return "woocommerce"
        return None

    @property
    def has_ecommerce(self) -> bool:
        """
        Check if any e-commerce platform is configured.

        Returns:
            True if either Shopify or WooCommerce is configured, False otherwise.
        """
        return self.platform is not None


class TenantSettings(BaseModel):
    """
    Root settings schema for tenant configuration.

    This is the top-level wrapper for all tenant-specific settings stored in the
    `settings` JSON column of the Tenant model. Currently contains e-commerce
    configuration, but can be extended with additional settings in the future.

    Attributes:
        ecommerce: E-commerce platform configuration (optional)

    Example:
        ```python
        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://my-store.myshopify.com",
                    access_token="shpat_xxx",
                    api_version="2024-01"
                )
            )
        )
        ```
    """

    ecommerce: EcommerceSettings | None = Field(
        None,
        description="E-commerce platform configuration",
    )

    @property
    def platform(self) -> Literal["shopify", "woocommerce"] | None:
        """
        Convenience property to get the configured e-commerce platform.

        Returns:
            'shopify', 'woocommerce', or None based on ecommerce configuration.
        """
        if self.ecommerce is None:
            return None
        return self.ecommerce.platform

    @property
    def has_ecommerce(self) -> bool:
        """
        Convenience property to check if e-commerce is configured.

        Returns:
            True if an e-commerce platform is configured, False otherwise.
        """
        if self.ecommerce is None:
            return False
        return self.ecommerce.has_ecommerce
