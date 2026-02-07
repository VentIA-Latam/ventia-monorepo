"""
Platform statistics endpoints.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_database,
    require_permission_dual,
)
from app.models.user import User
from app.schemas.activity import RecentActivityResponse
from app.schemas.stats import StatsResponse
from app.services.activity import activity_service
from app.services.stats import stats_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=StatsResponse, tags=["stats"])
async def get_platform_stats(
    current_user: User = Depends(require_permission_dual("GET", "/stats")),
    db: Session = Depends(get_database),
) -> StatsResponse:
    """
    Get platform statistics.

    **Authentication:** Requires JWT token (Auth0).

    **Access Control:**
    - SUPERADMIN: Can access platform statistics
    - Other roles: Access denied (403 Forbidden)

    **Statistics Included:**
    - `total_tenants`: Total number of tenants created on the platform
    - `total_users`: Total number of registered users across all tenants
    - `active_api_keys`: Number of currently active API keys
    - `total_super_admins`: Total number of super admin users

    Args:
        current_user: Current authenticated user (SUPERADMIN only)
        db: Database session

    Returns:
        StatsResponse with platform statistics

    Raises:
        HTTPException 403: If user is not SUPERADMIN
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


@router.get("/activity/recent", response_model=RecentActivityResponse, tags=["stats"])
async def get_recent_activity(
    current_user: User = Depends(require_permission_dual("GET", "/stats")),
    db: Session = Depends(get_database),
) -> RecentActivityResponse:
    """
    Get recent platform activity.

    **Authentication:** Requires JWT token (Auth0).

    **Access Control:**
    - SUPERADMIN: Can access activity logs
    - Other roles: Access denied (403 Forbidden)

    **Activity Tracked:**
    - Returns the 3 most recently modified entities from:
      - Users
      - Tenants
      - Orders
      - API Keys
    - Each entity's "recency" is determined by whichever is most recent: created_at or updated_at

    **Response:**
    - Returns the 3 most recent activities
    - Ordered by timestamp (created_at or updated_at, whichever is more recent)
    - Includes operation type (CREATED or UPDATED) and human-readable description

    Args:
        current_user: Current authenticated user (SUPERADMIN only)
        db: Database session

    Returns:
        RecentActivityResponse with 3 most recent activities across all tables

    Raises:
        HTTPException 403: If user is not SUPERADMIN
        HTTPException 500: If activity retrieval fails
    """
    try:
        return activity_service.get_recent_activities(db, limit=3)
    except Exception as e:
        logger.error(f"Failed to retrieve recent activities: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve activities: {str(e)}",
        )
