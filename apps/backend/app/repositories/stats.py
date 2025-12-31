"""
Statistics repository - database queries for platform statistics.
"""

from sqlalchemy.orm import Session

from app.core.permissions import Role
from app.models.api_key import APIKey
from app.models.tenant import Tenant
from app.models.user import User


class StatsRepository:
    """Repository for platform-wide statistics queries."""

    @staticmethod
    def count_total_tenants(db: Session) -> int:
        """
        Count total number of tenants created.

        Args:
            db: Database session

        Returns:
            Total count of tenants
        """
        return db.query(Tenant).count()

    @staticmethod
    def count_total_users(db: Session) -> int:
        """
        Count total number of registered users.

        Args:
            db: Database session

        Returns:
            Total count of users
        """
        return db.query(User).count()

    @staticmethod
    def count_active_api_keys(db: Session) -> int:
        """
        Count total number of active API keys.

        Args:
            db: Database session

        Returns:
            Total count of active API keys
        """
        return db.query(APIKey).filter(APIKey.is_active == True).count()

    @staticmethod
    def count_total_super_admins(db: Session) -> int:
        """
        Count total number of super admin users.

        Args:
            db: Database session

        Returns:
            Total count of super admin users
        """
        return db.query(User).filter(User.role == Role.SUPER_ADMIN).count()


# Create singleton instance
stats_repository = StatsRepository()
