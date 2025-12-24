"""
Health check endpoint.
"""

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns basic status information without requiring authentication.
    Useful for monitoring and load balancer health checks.

    Returns:
        HealthResponse: Health status
    """
    return HealthResponse(
        status="healthy",
        message="VentIA Backend API is running",
    )
