"""
Activity schemas - represents recent platform activity from all tables.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class ActivityItem(BaseModel):
    """Activity item representing a recent change across any table."""

    id: int = Field(..., description="Entity ID")
    entity_type: str = Field(..., description="Type of entity (user, tenant, order, api_key)")
    operation: str = Field(..., description="Operation type (CREATED or UPDATED)")
    description: str = Field(..., description="Human-readable description of the entity")
    timestamp: datetime = Field(..., description="When the entity was created or updated (whichever is more recent)")

    model_config = {"from_attributes": True}


class RecentActivityResponse(BaseModel):
    """Schema for recent platform activity response."""

    activities: list[ActivityItem] = Field(
        ..., description="List of 3 most recent activities from all tables"
    )