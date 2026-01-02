"""
Tenant (Company) schemas for request/response validation.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    company_id: Optional[str] = Field(
        None, max_length=100, description="Company ID for Auth0 organization mapping"
    )
    shopify_store_url: Optional[str] = Field(
        None, description="Shopify store URL (e.g., 'https://my-store.myshopify.com')"
    )
    shopify_api_version: Optional[str] = Field(
        "2024-01", description="Shopify API version (e.g., '2024-01')"
    )

    @field_validator("shopify_store_url")
    @classmethod
    def validate_shopify_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate Shopify store URL format."""
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Shopify store URL must start with http:// or https://")
        return v


class TenantCreate(BaseModel):
    """
    Schema for creating a new tenant.

    Request body fields:
    - name: Required, max 100 chars
    - slug: Optional, auto-generated as "name-outlet" in kebab-case if not provided
    - company_id: Optional, for Auth0 organization mapping
<<<<<<< HEAD
    - shopify_store_url: Required, must be a valid URL
    - shopify_access_token: Required, plaintext (will be encrypted before storage)
=======
    - shopify_store_url: Optional, must be a valid URL if provided
    - shopify_access_token: Optional, plaintext (will be encrypted before storage)
>>>>>>> 9fe11f50eb29384a183706e09d5026d444d4bb48
    - shopify_api_version: Optional, defaults to "2024-01"

    **Auto-generated slug:**
    - Format: "{name-in-kebab-case}-outlet"
    - Examples:
      - "My Company" -> "my-company-outlet"
      - "Test_123" -> "test-123-outlet"
    - Slug must be unique in the system

    **Security Note**: shopify_access_token is sent as plaintext in the request body
    but is automatically encrypted by the Tenant model before storage.
    """

    name: str = Field(..., min_length=1, max_length=100, description="Company name (required)")
    slug: Optional[str] = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-friendly identifier (kebab-case, optional - auto-generated as 'name-outlet' if not provided)",
    )
    company_id: Optional[str] = Field(
        None, max_length=100, description="Company ID for Auth0 organization mapping (optional)"
    )
    shopify_store_url: Optional[str] = Field(
        None, description="Shopify store URL (optional, e.g., 'https://my-store.myshopify.com')"
    )
    shopify_access_token: Optional[str] = Field(
        None, description="Shopify Admin API access token (optional, plaintext - will be encrypted before storage)"
    )
    shopify_api_version: Optional[str] = Field(
        "2024-01", description="Shopify API version (optional, defaults to '2024-01')"
    )

    @field_validator("shopify_store_url", mode="before")
    @classmethod
    def validate_shopify_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate Shopify store URL format."""
        # Allow None or empty string (optional field)
        if not v:
            return None
        # If provided, must be a valid URL
        if not v.startswith(("http://", "https://")):
            raise ValueError("Shopify store URL must start with http:// or https://")
        return v

    @field_validator("slug", mode="before")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        """Validate slug format if provided."""
        # Allow None or empty string (will be auto-generated from name)
        if not v:
            return None
        # If provided with a value, validate format
        if not v.islower():
            raise ValueError("Slug must be lowercase (kebab-case)")
        return v


class TenantUpdate(BaseModel):
    """
    Schema for updating a tenant.

    **Updatable fields:**
    - name: Company name
    - shopify_store_url: Shopify store URL (must be valid URL)
    - shopify_access_token: Shopify Admin API access token (plaintext, will be encrypted)
    - shopify_api_version: Shopify API version
    - is_active: Active status

    **Immutable fields (cannot be changed):**
    - slug: Auto-generated at creation, cannot be modified
    - id: Primary key, immutable
    - is_platform: Set at creation, cannot be modified after creation
    - company_id: Set at creation, cannot be modified (handled at DB level)

    All fields are optional. Only provided fields will be updated.

    **Security Note**: shopify_access_token is sent as plaintext in the request body
    but is automatically encrypted by the Tenant model before storage.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    shopify_store_url: Optional[str] = None
    shopify_access_token: Optional[str] = Field(
        None, description="Shopify Admin API access token (plaintext, will be encrypted)"
    )
    shopify_api_version: Optional[str] = None
    is_active: Optional[bool] = None
    is_platform: Optional[bool] = Field(
        None, description="Cannot be changed after creation (will be rejected by service)"
    )

    @field_validator("shopify_store_url")
    @classmethod
    def validate_shopify_url(cls, v: Optional[str]) -> Optional[str]:
        """Validate Shopify store URL format."""
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Shopify store URL must start with http:// or https://")
        return v


class TenantResponse(BaseModel):
    """
    Schema for tenant in API responses.

    **Security**: shopify_access_token and shopify_api_version are NEVER included in responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    company_id: Optional[str]
    shopify_store_url: Optional[str]
    is_platform: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


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

    shopify_access_token: Optional[str] = Field(
        None, description="Shopify access token (decrypted)"
    )

    model_config = ConfigDict(from_attributes=True)
