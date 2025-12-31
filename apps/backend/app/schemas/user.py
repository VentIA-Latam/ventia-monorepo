"""
User schemas.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

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
    name: str = Field(..., description="User full name (required)")
    role: Role = Field(..., description="User role (required)")

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v) -> Role:
        """Validate role: prevent SUPER_ADMIN and show only allowed roles."""
        if isinstance(v, Role):
            role_obj = v
        else:
            # Convert string to Role enum
            try:
                role_obj = Role[str(v).upper()]
            except KeyError:
                valid_roles = [r.name.lower() for r in Role if r != Role.SUPER_ADMIN]
                raise ValueError(f"Invalid role. Allowed roles: {', '.join(valid_roles)}")

        # Prevent SUPER_ADMIN
        if role_obj == Role.SUPER_ADMIN:
            valid_roles = [r.name.lower() for r in Role if r != Role.SUPER_ADMIN]
            raise ValueError(f"Cannot create SUPER_ADMIN users. Allowed roles: {', '.join(valid_roles)}")

        return role_obj


class UserUpdate(BaseModel):
    """Schema for updating a User (only name, role, is_active can be updated)."""

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


class TenantInfo(BaseModel):
    """Schema for tenant info in user response."""

    id: int
    name: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class UserWithTenant(UserResponse):
    """Schema for User response with tenant info."""

    tenant: TenantInfo = Field(..., description="Tenant info (id, name, slug)")

    model_config = ConfigDict(from_attributes=True)


class UsersListResponse(BaseModel):
    """Schema for paginated users list with metadata."""

    total: int = Field(..., description="Total number of items")
    items: list[UserWithTenant] = Field(..., description="List of users with tenant info")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Maximum items per page")

    model_config = ConfigDict(from_attributes=True)


class UserUpdateResponse(BaseModel):
    """Schema for user update response with optional warning."""

    user: UserResponse = Field(..., description="Updated user")
    warning: str | None = Field(None, description="Warning message if applicable")

    model_config = ConfigDict(from_attributes=True)
