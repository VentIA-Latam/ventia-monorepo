"""
Statistics service - business logic for platform statistics.
"""

from sqlalchemy.orm import Session

from app.repositories.stats import stats_repository
from app.schemas.stats import StatsResponse


class StatsService:
    """Service for platform statistics."""

    @staticmethod
    def get_platform_stats(db: Session) -> StatsResponse:
        """
        Get comprehensive platform statistics.

        **Statistics Include:**
        - total_tenants: All tenants created on the platform
        - total_users: All users registered across all tenants
        - active_api_keys: API keys currently active (is_active=True)
        - total_super_admins: Users with SUPER_ADMIN role

        Args:
            db: Database session

        Returns:
            StatsResponse with all platform statistics
        """
        return StatsResponse(
            total_tenants=stats_repository.count_total_tenants(db),
            total_users=stats_repository.count_total_users(db),
            active_api_keys=stats_repository.count_active_api_keys(db),
            total_super_admins=stats_repository.count_total_super_admins(db),
        )


# Create singleton instance
stats_service = StatsService()
