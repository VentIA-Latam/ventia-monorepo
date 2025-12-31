"""
Activity schemas.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ActivityResponse(BaseModel):
    """Schema for Activity response."""

    id: int
    action_type: str = Field(..., description="Type of action performed")
    description: str = Field(..., description="Human-readable description")
    entity_type: str = Field(..., description="Type of entity affected")
    entity_id: int | None = Field(None, description="ID of affected entity")
    performed_by: str | None = Field(None, description="User who performed action")
    created_at: datetime = Field(..., description="When the action occurred")

    model_config = {"from_attributes": True}


class RecentActivityResponse(BaseModel):
    """Schema for recent platform activity response."""

    activities: list[ActivityResponse] = Field(
        ..., description="List of 3 most recent activities"
    )
