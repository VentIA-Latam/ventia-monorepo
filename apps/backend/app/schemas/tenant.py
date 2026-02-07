"""
Tenant (Company) schemas for request/response validation.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TenantBase(BaseModel):
    """Base tenant schema with common fields."""

    name: str = Field(..., min_length=1, max_length=100, description="Company name")
    slug: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-friendly identifier (kebab-case)",
    )
    company_id: str | None = Field(
        None, max_length=100, description="Company ID for Auth0 organization mapping"
    )
    efact_ruc: str | None = Field(
        None,
        pattern=r"^\d{11}$",
        description="RUC del tenant para facturación electrónica (11 dígitos)",
    )


class TenantCreate(BaseModel):
    """
    Schema for creating a new tenant.

    Request body fields:
    - name: Required, max 100 chars
    - slug: Optional, auto-generated as "name-outlet" in kebab-case if not provided
    - company_id: Optional, for Auth0 organization mapping

    **E-commerce Configuration:**
    - ecommerce_platform: "shopify" | "woocommerce" | None
    - ecommerce_store_url: Store URL (required if platform is set)

    **Shopify OAuth2:**
    - shopify_client_id: Shopify OAuth2 client ID (required for Shopify)
    - shopify_client_secret: Shopify OAuth2 client secret (required for Shopify)
    - shopify_api_version: Shopify API version (default: '2025-10')

    **WooCommerce:**
    - ecommerce_consumer_key: WooCommerce consumer key (for WooCommerce only)
    - ecommerce_consumer_secret: WooCommerce consumer secret (for WooCommerce only)

    - sync_on_validation: Whether to sync to e-commerce when validating payment (default: True)

    **Security Note**: All OAuth2 credentials and secrets are sent as plaintext in the request body
    but are automatically encrypted before storage in the settings JSON field.
    """

    name: str = Field(..., min_length=1, max_length=100, description="Company name (required)")
    slug: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-friendly identifier (kebab-case, optional - auto-generated as 'name-outlet' if not provided)",
    )
    company_id: str | None = Field(
        None, max_length=100, description="Company ID for Auth0 organization mapping (optional)"
    )

    # === E-COMMERCE CONFIGURATION ===
    ecommerce_platform: Literal["shopify", "woocommerce"] | None = Field(
        None, description="E-commerce platform: 'shopify' or 'woocommerce'"
    )
    ecommerce_store_url: str | None = Field(
        None,
        description="E-commerce store URL (e.g., 'https://my-store.myshopify.com' or 'https://my-store.com')",
    )

    # Shopify OAuth2
    shopify_client_id: str | None = Field(
        None, description="Shopify OAuth2 client ID (required for Shopify, will be encrypted)"
    )
    shopify_client_secret: str | None = Field(
        None, description="Shopify OAuth2 client secret (required for Shopify, will be encrypted)"
    )
    shopify_api_version: str | None = Field(
        None, description="Shopify API version (only for Shopify, default: '2025-10')"
    )

    # WooCommerce
    ecommerce_consumer_key: str | None = Field(
        None,
        description="WooCommerce REST API consumer key (only for WooCommerce, will be encrypted)",
    )
    ecommerce_consumer_secret: str | None = Field(
        None,
        description="WooCommerce REST API consumer secret (only for WooCommerce, will be encrypted)",
    )
    sync_on_validation: bool = Field(
        True, description="Sync order status to e-commerce platform when payment is validated"
    )

    # === INVOICING ===
    efact_ruc: str | None = Field(
        None,
        pattern=r"^\d{11}$",
        description="RUC del tenant para facturación electrónica (optional, 11 dígitos)",
    )
    emisor_nombre_comercial: str | None = Field(
        None,
        max_length=200,
        description="Nombre comercial del emisor para facturas electrónicas"
    )
    emisor_ubigeo: str | None = Field(
        None,
        pattern=r"^\d{6}$",
        description="Código UBIGEO del emisor (6 dígitos, estándar INEI Perú)"
    )
    emisor_departamento: str | None = Field(
        None,
        max_length=100,
        description="Departamento del emisor (e.g., 'LIMA', 'AREQUIPA')"
    )
    emisor_provincia: str | None = Field(
        None,
        max_length=100,
        description="Provincia del emisor"
    )
    emisor_distrito: str | None = Field(
        None,
        max_length=100,
        description="Distrito del emisor"
    )
    emisor_direccion: str | None = Field(
        None,
        max_length=500,
        description="Dirección fiscal del emisor"
    )

    @field_validator("ecommerce_store_url", mode="before")
    @classmethod
    def validate_store_url(cls, v: str | None) -> str | None:
        """Validate store URL format."""
        if not v:
            return None
        if not v.startswith(("http://", "https://")):
            raise ValueError("Store URL must start with http:// or https://")
        return v.rstrip("/")

    @field_validator("slug", mode="before")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        """Validate slug format if provided."""
        if not v:
            return None
        if not v.islower():
            raise ValueError("Slug must be lowercase (kebab-case)")
        return v

    @model_validator(mode="after")
    def validate_ecommerce_config(self) -> "TenantCreate":
        """
        Validate e-commerce configuration consistency.

        Rules:
        - If ecommerce_platform is set, ecommerce_store_url is required
        - Shopify uses OAuth2 (client_id/client_secret, optional - can be set later)
        - WooCommerce uses consumer_key/consumer_secret (optional, can be set later)
        - Cannot mix Shopify and WooCommerce credentials
        """
        if self.ecommerce_platform:
            if not self.ecommerce_store_url:
                raise ValueError(
                    f"ecommerce_store_url is required when ecommerce_platform is '{self.ecommerce_platform}'"
                )

            if self.ecommerce_platform == "shopify":
                # Shopify should not have WooCommerce credentials
                if self.ecommerce_consumer_key or self.ecommerce_consumer_secret:
                    raise ValueError(
                        "Cannot use WooCommerce credentials (consumer_key/consumer_secret) with Shopify platform"
                    )

            elif self.ecommerce_platform == "woocommerce":
                # WooCommerce should not have Shopify credentials
                if self.shopify_client_id or self.shopify_client_secret:
                    raise ValueError(
                        "Cannot use Shopify credentials (client_id/client_secret) with WooCommerce platform"
                    )

        return self


class TenantUpdate(BaseModel):
    """
    Schema for updating a tenant.

    **Updatable fields:**
    - name: Company name
    - is_active: Active status
    - efact_ruc: RUC for electronic invoicing

    **E-commerce Configuration:**
    - ecommerce_platform: "shopify" | "woocommerce" | None (set to None to clear)
    - ecommerce_store_url: Store URL
    - shopify_client_id: Shopify OAuth2 client ID (will be encrypted)
    - shopify_client_secret: Shopify OAuth2 client secret (will be encrypted)
    - shopify_api_version: Shopify API version
    - ecommerce_consumer_key: WooCommerce consumer key (will be encrypted)
    - ecommerce_consumer_secret: WooCommerce consumer secret (will be encrypted)
    - sync_on_validation: Sync to e-commerce on payment validation

    **Immutable fields (cannot be changed):**
    - slug, id, is_platform, company_id

    All fields are optional. Only provided fields will be updated.
    """

    name: str | None = Field(None, min_length=1, max_length=100)
    is_active: bool | None = None
    is_platform: bool | None = Field(
        None, description="Cannot be changed after creation (will be rejected by service)"
    )

    # === E-COMMERCE CONFIGURATION ===
    ecommerce_platform: Literal["shopify", "woocommerce"] | None = Field(
        None,
        description="E-commerce platform: 'shopify' or 'woocommerce' (set explicitly to change)",
    )
    ecommerce_store_url: str | None = Field(None, description="E-commerce store URL")

    # Shopify OAuth2
    shopify_client_id: str | None = Field(
        None, description="Shopify OAuth2 client ID (only for Shopify, will be encrypted)"
    )
    shopify_client_secret: str | None = Field(
        None, description="Shopify OAuth2 client secret (only for Shopify, will be encrypted)"
    )
    shopify_api_version: str | None = Field(
        None, description="Shopify API version (only for Shopify)"
    )

    # WooCommerce
    ecommerce_consumer_key: str | None = Field(
        None,
        description="WooCommerce REST API consumer key (only for WooCommerce, will be encrypted)",
    )
    ecommerce_consumer_secret: str | None = Field(
        None,
        description="WooCommerce REST API consumer secret (only for WooCommerce, will be encrypted)",
    )
    sync_on_validation: bool | None = Field(
        None, description="Sync order status to e-commerce platform when payment is validated"
    )

    # === INVOICING ===
    efact_ruc: str | None = Field(
        None,
        pattern=r"^\d{11}$",
        description="RUC del tenant para facturación electrónica (11 dígitos)",
    )
    emisor_nombre_comercial: str | None = Field(
        None,
        max_length=200,
        description="Nombre comercial del emisor para facturas electrónicas"
    )
    emisor_ubigeo: str | None = Field(
        None,
        pattern=r"^\d{6}$",
        description="Código UBIGEO del emisor (6 dígitos, estándar INEI Perú)"
    )
    emisor_departamento: str | None = Field(
        None,
        max_length=100,
        description="Departamento del emisor (e.g., 'LIMA', 'AREQUIPA')"
    )
    emisor_provincia: str | None = Field(
        None,
        max_length=100,
        description="Provincia del emisor"
    )
    emisor_distrito: str | None = Field(
        None,
        max_length=100,
        description="Distrito del emisor"
    )
    emisor_direccion: str | None = Field(
        None,
        max_length=500,
        description="Dirección fiscal del emisor"
    )

    @field_validator("ecommerce_store_url", mode="before")
    @classmethod
    def validate_store_url(cls, v: str | None) -> str | None:
        """Validate store URL format."""
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Store URL must start with http:// or https://")
        return v.rstrip("/") if v else v


class EcommerceSettingsResponse(BaseModel):
    """
    Sanitized e-commerce settings for API responses.

    **Security**: NEVER includes access_token, consumer_key, or consumer_secret.
    Only shows platform type, store URL, and sync configuration.
    """

    platform: Literal["shopify", "woocommerce"] | None = Field(
        None, description="Configured e-commerce platform"
    )
    store_url: str | None = Field(None, description="E-commerce store URL")
    sync_on_validation: bool = Field(
        True, description="Whether orders sync to e-commerce on validation"
    )
    has_credentials: bool = Field(
        False, description="Whether credentials are configured (without exposing them)"
    )


class TenantResponse(BaseModel):
    """
    Schema for tenant in API responses.

    **Security**:
    - E-commerce credentials (access_token, consumer_key, consumer_secret) are NEVER exposed
    - ecommerce_settings shows platform config with has_credentials flag instead

    **E-commerce Configuration**:
    - ecommerce_settings.platform: "shopify" | "woocommerce" | None
    - ecommerce_settings.store_url: E-commerce store URL
    - ecommerce_settings.sync_on_validation: Whether sync is enabled
    - ecommerce_settings.has_credentials: Boolean indicating if credentials are set (without exposing them)
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    company_id: str | None
    efact_ruc: str | None
    emisor_nombre_comercial: str | None
    emisor_ubigeo: str | None
    emisor_departamento: str | None
    emisor_provincia: str | None
    emisor_distrito: str | None
    emisor_direccion: str | None
    is_platform: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Sanitized e-commerce settings (never includes credentials)
    ecommerce_settings: EcommerceSettingsResponse | None = Field(
        None, description="E-commerce platform configuration (credentials hidden)"
    )

    @classmethod
    def from_tenant(cls, tenant: Any) -> "TenantResponse":
        """
        Create a TenantResponse from a Tenant model with sanitized ecommerce_settings.

        This method safely extracts e-commerce settings without exposing credentials.

        Args:
            tenant: Tenant model instance

        Returns:
            TenantResponse with sanitized ecommerce_settings
        """
        # Build sanitized ecommerce settings
        ecommerce_settings = None

        if hasattr(tenant, "get_settings") and callable(tenant.get_settings):
            try:
                settings = tenant.get_settings()
                if settings.ecommerce and settings.ecommerce.has_ecommerce:
                    ecommerce = settings.ecommerce

                    # Determine if credentials are configured
                    has_credentials = False
                    store_url = None

                    if ecommerce.platform == "shopify" and ecommerce.shopify:
                        store_url = ecommerce.shopify.store_url
                        # OAuth2: Check for client_id and client_secret
                        has_credentials = bool(ecommerce.shopify.client_id and ecommerce.shopify.client_secret)
                    elif ecommerce.platform == "woocommerce" and ecommerce.woocommerce:
                        store_url = ecommerce.woocommerce.store_url
                        has_credentials = bool(
                            ecommerce.woocommerce.consumer_key
                            and ecommerce.woocommerce.consumer_secret
                        )

                    ecommerce_settings = EcommerceSettingsResponse(
                        platform=ecommerce.platform,
                        store_url=store_url,
                        sync_on_validation=ecommerce.sync_on_validation,
                        has_credentials=has_credentials,
                    )
            except Exception:
                # If settings parsing fails, leave ecommerce_settings as None
                pass

        return cls(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            company_id=tenant.company_id,
            efact_ruc=tenant.efact_ruc,
            emisor_nombre_comercial=tenant.emisor_nombre_comercial,
            emisor_ubigeo=tenant.emisor_ubigeo,
            emisor_departamento=tenant.emisor_departamento,
            emisor_provincia=tenant.emisor_provincia,
            emisor_distrito=tenant.emisor_distrito,
            emisor_direccion=tenant.emisor_direccion,
            is_platform=tenant.is_platform,
            is_active=tenant.is_active,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
            ecommerce_settings=ecommerce_settings,
        )


class TenantDetailResponse(TenantResponse):
    """
    Extended tenant response with statistics.

    Used for detail views that include user and order counts.
    """

    user_count: int = Field(..., description="Number of active users in this tenant")
    order_count: int = Field(..., description="Total number of orders for this tenant")


class TenantListResponse(BaseModel):
    """Schema for paginated list of tenants."""

    total: int = Field(..., description="Total number of tenants matching the filter")
    items: list[TenantResponse]
    skip: int = Field(..., description="Number of records skipped")
    limit: int = Field(..., description="Maximum number of records returned")


class TenantWithToken(TenantResponse):
    """
    Schema for Tenant with access token (internal use only).

    WARNING: Only use this for internal service-to-service communication.
    Never return this directly to API clients.
    """

    shopify_access_token: str | None = Field(None, description="Shopify access token (decrypted)")

    model_config = ConfigDict(from_attributes=True)
