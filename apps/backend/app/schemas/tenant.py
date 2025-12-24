"""
Tenant (Company) schemas.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TenantBase(BaseModel):
    """Base schema for Tenant with common fields."""

    name: str = Field(..., description="Company name")
    slug: str = Field(..., description="URL-friendly identifier")
    company_id: str = Field(..., description="Company ID for Auth0 organization")
    shopify_store_url: str = Field(..., description="Shopify store URL")
    shopify_api_version: str = Field(default="2024-01", description="Shopify API version")
    is_active: bool = Field(default=True, description="Is tenant active")
    settings: dict[str, Any] | None = Field(None, description="Additional settings")


class TenantCreate(TenantBase):
    """Schema for creating a new Tenant."""

    shopify_access_token: str = Field(
        ...,
        description="Shopify Admin API access token (will be encrypted)",
    )


class TenantUpdate(BaseModel):
    """Schema for updating a Tenant (all fields optional)."""

    name: str | None = None
    slug: str | None = None
    company_id: str | None = None
    shopify_store_url: str | None = None
    shopify_access_token: str | None = Field(
        None,
        description="Shopify access token (will be encrypted)",
    )
    shopify_api_version: str | None = None
    is_active: bool | None = None
    settings: dict[str, Any] | None = None


class TenantResponse(TenantBase):
    """
    Schema for Tenant response.

    IMPORTANT: Does NOT include shopify_access_token for security.
    """

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TenantWithToken(TenantResponse):
    """
    Schema for Tenant with access token (internal use only).

    WARNING: Only use this for internal service-to-service communication.
    Never return this directly to API clients.
    """

    shopify_access_token: str = Field(..., description="Shopify access token")

    model_config = ConfigDict(from_attributes=True)
