"""
Activity repository - queries recent changes across all tables using optimized SQL queries.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.api_key import APIKey
from app.models.order import Order
from app.models.tenant import Tenant
from app.models.user import User


class ActivityRepository:
    """Repository for retrieving recent platform activity from all tables."""

    @staticmethod
    def get_recent_activities(db: Session, limit: int = 10) -> list[dict]:
        """
        Get the most recent activities across all tables.

        Uses optimized ORM queries with ORDER BY and LIMIT at the database level,
        then merges the results in Python (over a small set of 4*limit rows max).

        Args:
            db: Database session
            limit: Number of activities to return (default 10)

        Returns:
            List of dicts with: id, entity_type, description, timestamp, operation
        """
        activities = []

        # Query users - only fetch top N most recent
        most_recent_user = func.greatest(
            User.created_at,
            func.coalesce(User.updated_at, User.created_at),
        )
        users = (
            db.query(User)
            .order_by(most_recent_user.desc())
            .limit(limit)
            .all()
        )
        for user in users:
            most_recent = user.updated_at if user.updated_at else user.created_at
            operation = "UPDATED" if (
                user.updated_at and user.updated_at > user.created_at) else "CREATED"
            activities.append({
                "id": user.id,
                "entity_type": "user",
                "operation": operation,
                "description": f"User: {user.email}" + (f" ({user.name})" if user.name else ""),
                "timestamp": most_recent,
            })

        # Query tenants - only fetch top N most recent
        most_recent_tenant = func.greatest(
            Tenant.created_at,
            func.coalesce(Tenant.updated_at, Tenant.created_at),
        )
        tenants = (
            db.query(Tenant)
            .order_by(most_recent_tenant.desc())
            .limit(limit)
            .all()
        )
        for tenant in tenants:
            most_recent = tenant.updated_at if tenant.updated_at else tenant.created_at
            operation = "UPDATED" if (
                tenant.updated_at and tenant.updated_at > tenant.created_at) else "CREATED"
            activities.append({
                "id": tenant.id,
                "entity_type": "tenant",
                "operation": operation,
                "description": f"Empresa: {tenant.name} ({tenant.slug})",
                "timestamp": most_recent,
            })

        # Query orders - only fetch top N most recent
        most_recent_order = func.greatest(
            Order.created_at,
            func.coalesce(Order.updated_at, Order.created_at),
        )
        orders = (
            db.query(Order)
            .order_by(most_recent_order.desc())
            .limit(limit)
            .all()
        )
        for order in orders:
            most_recent = order.updated_at if order.updated_at else order.created_at
            operation = "UPDATED" if (
                order.updated_at and order.updated_at > order.created_at) else "CREATED"
            activities.append({
                "id": order.id,
                "entity_type": "order",
                "operation": operation,
                "description": f"Order: {order.customer_email}" + (f" ({order.customer_name})" if order.customer_name else ""),
                "timestamp": most_recent,
            })

        # Query API keys - only fetch top N most recent
        most_recent_key = func.greatest(
            APIKey.created_at,
            func.coalesce(APIKey.updated_at, APIKey.created_at),
        )
        api_keys = (
            db.query(APIKey)
            .order_by(most_recent_key.desc())
            .limit(limit)
            .all()
        )
        for api_key in api_keys:
            most_recent = api_key.updated_at if api_key.updated_at else api_key.created_at
            operation = "UPDATED" if (
                api_key.updated_at and api_key.updated_at > api_key.created_at) else "CREATED"
            activities.append({
                "id": api_key.id,
                "entity_type": "api_key",
                "operation": operation,
                "description": f"API Key: {api_key.name} ({api_key.key_prefix}...)",
                "timestamp": most_recent,
            })

        # Sort combined results (max 4*limit rows) and return top N
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        return activities[:limit]


# Create singleton instance
activity_repository = ActivityRepository()
