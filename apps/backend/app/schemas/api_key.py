"""
API Key schemas for external integrations.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.permissions import Role


class APIKeyCreate(BaseModel):
    """Schema for creating a new API key."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Human-readable name for the API key (e.g., 'n8n-production')",
        examples=["n8n-production", "automation-dev", "integration-test"],
    )
    role: Role = Field(
        ...,
        description="Role for this API key (ADMIN, LOGISTICA, VENTAS, VIEWER). Cannot be SUPER_ADMIN.",
        examples=[Role.ADMIN, Role.LOGISTICA],
    )
    tenant_id: int | None = Field(
        None,
        description="Tenant ID for the API key. Only SUPER_ADMIN can specify this. If not provided, uses current user's tenant.",
    )
    expires_at: datetime | None = Field(
        None,
        description="Optional expiration date. If null, the key never expires.",
        examples=["2025-12-31T23:59:59"],
    )


class APIKeyCreateResponse(BaseModel):
    """
    Response after creating an API key.

    ⚠️ IMPORTANT: The 'key' field is only returned ONCE during creation.
    Save it securely - you won't be able to see it again!
    """

    id: int
    name: str
    key: str = Field(
        ...,
        description="The complete API key. SAVE THIS - it won't be shown again!",
        examples=["vnt_nassau_aB3xYz9pQr5mN7wK2sT4uV6cF8hJ1d"],
    )
    key_prefix: str = Field(
        ...,
        description="First 12 characters of the key for identification",
        examples=["vnt_nassau_a"],
    )
    role: Role
    tenant_id: int
    expires_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class APIKeyResponse(BaseModel):
    """
    Standard API key response.

    The complete key is NOT included for security. Only the prefix is shown.
    """

    id: int
    name: str
    key_prefix: str = Field(
        ...,
        description="First 12 characters for identification (e.g., 'vnt_nassau_a')",
    )
    role: Role
    tenant_id: int
    is_active: bool
    last_used_at: datetime | None = Field(
        None,
        description="Last time this API key was used for authentication",
    )
    expires_at: datetime | None
    created_by_user_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class APIKeyWithCreator(APIKeyResponse):
    """API key response with creator user information."""

    created_by: dict | None = Field(
        None,
        description="User who created this API key (id, name, email)",
    )

    model_config = ConfigDict(from_attributes=True)


class APIKeyUpdate(BaseModel):
    """Schema for updating an API key (all fields optional)."""

    name: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        description="Update the name of the API key",
    )
    is_active: bool | None = Field(
        None,
        description="Activate or deactivate the API key",
    )
    expires_at: datetime | None = Field(
        None,
        description="Update expiration date (can be set to null to remove expiration)",
    )


class APIKeyListResponse(BaseModel):
    """Paginated list of API keys."""

    total: int = Field(..., description="Total number of API keys")
    items: list[APIKeyResponse] = Field(..., description="List of API keys")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Number of items per page")

    model_config = ConfigDict(from_attributes=True)
