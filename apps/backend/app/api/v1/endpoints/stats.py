"""
Platform statistics endpoints.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_database,
    require_permission,
)
from app.core.permissions import Role
from app.models.user import User
from app.schemas.stats import StatsResponse
from app.services.stats import stats_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=StatsResponse, tags=["stats"])
async def get_platform_stats(
    current_user: User = Depends(require_permission("GET", "/stats")),
    db: Session = Depends(get_database),
) -> StatsResponse:
    """
    Get platform statistics.

    **Authentication:** Requires JWT token (Auth0).

    **Access Control:**
    - SUPER_ADMIN: Can access platform statistics
    - Other roles: Access denied (403 Forbidden)

    **Statistics Included:**
    - `total_tenants`: Total number of tenants created on the platform
    - `total_users`: Total number of registered users across all tenants
    - `active_api_keys`: Number of currently active API keys
    - `total_super_admins`: Total number of super admin users

    Args:
        current_user: Current authenticated user (SUPER_ADMIN only)
        db: Database session

    Returns:
        StatsResponse with platform statistics

    Raises:
        HTTPException 403: If user is not SUPER_ADMIN
        HTTPException 500: If statistics retrieval fails
    """
    try:
        return stats_service.get_platform_stats(db)
    except Exception as e:
        logger.error(f"Failed to retrieve platform statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve statistics: {str(e)}",
        )
