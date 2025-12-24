"""
Health check schemas.
"""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str
    message: str

    model_config = {"from_attributes": True}
