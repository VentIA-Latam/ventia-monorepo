"""
Activity service - retrieves recent platform activities from all tables.
"""

from sqlalchemy.orm import Session

from app.repositories.activity import activity_repository
from app.schemas.activity import ActivityItem, RecentActivityResponse


class ActivityService:
    """Service for retrieving recent platform activities."""

    @staticmethod
    def get_recent_activities(db: Session, limit: int = 3) -> RecentActivityResponse:
        """
        Get recent platform activities from all tables.

        Queries users, tenants, orders, and api_keys tables. For each entity,
        compares created_at and updated_at to determine the most recent timestamp.
        Returns the N most recent activities overall.

        Args:
            db: Database session
            limit: Number of activities to return (default 3)

        Returns:
            RecentActivityResponse with recent activities across all tables
        """
        activities_data = activity_repository.get_recent_activities(db, limit=limit)
        activities = [ActivityItem(**activity) for activity in activities_data]
        return RecentActivityResponse(activities=activities)


# Create singleton instance
activity_service = ActivityService()
