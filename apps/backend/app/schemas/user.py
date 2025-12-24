"""
User schemas.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.permissions import Role


class UserBase(BaseModel):
    """Base schema for User with common fields."""

    email: EmailStr = Field(..., description="User email address")
    name: str | None = Field(None, description="User full name")
    role: Role = Field(default=Role.VIEWER, description="User role")
    is_active: bool = Field(default=True, description="Is user active")


class UserCreate(UserBase):
    """Schema for creating a new User."""

    auth0_user_id: str = Field(..., description="Auth0 user ID (sub claim)")
    tenant_id: int = Field(..., description="Tenant ID this user belongs to")


class UserUpdate(BaseModel):
    """Schema for updating a User (all fields optional)."""

    email: EmailStr | None = None
    name: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class UserResponse(UserBase):
    """Schema for User response."""

    id: int
    auth0_user_id: str
    tenant_id: int
    last_login: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserWithTenant(UserResponse):
    """Schema for User response with tenant info."""

    tenant: dict = Field(..., description="Tenant info (name, slug)")

    model_config = ConfigDict(from_attributes=True)
