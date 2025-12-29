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


class TenantCreate(TenantBase):
    """
    Schema for creating a new tenant.

    Shopify credentials are optional at creation time and can be added later via update.

    **Security Note**: shopify_access_token is sent as plaintext in the request body
    but is automatically encrypted by the Tenant model before storage.
    """

    shopify_access_token: Optional[str] = Field(
        None,
        description="Shopify Admin API access token (plaintext, will be encrypted before storage)",
    )


class TenantUpdate(BaseModel):
    """
    Schema for updating a tenant.

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

    **Security**: shopify_access_token is NEVER included in responses.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    company_id: Optional[str]
    shopify_store_url: Optional[str]
    shopify_api_version: Optional[str]
    is_platform: bool
    is_active: bool
    settings: Optional[dict[str, Any]]
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
