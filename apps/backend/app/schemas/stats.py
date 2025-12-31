"""
Statistics schemas.
"""

from pydantic import BaseModel, Field


class StatsResponse(BaseModel):
    """Response schema for platform statistics."""

    total_tenants: int = Field(
        ..., description="Total number of tenants created", ge=0
    )
    total_users: int = Field(
        ..., description="Total number of registered users", ge=0
    )
    active_api_keys: int = Field(
        ..., description="Number of active API keys", ge=0
    )
    total_super_admins: int = Field(
        ..., description="Total number of super admin users", ge=0
    )
