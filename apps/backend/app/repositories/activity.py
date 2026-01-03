"""
Activity repository - queries recent changes across all tables by comparing created_at and updated_at.
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.models.api_key import APIKey
from app.models.order import Order
from app.models.tenant import Tenant
from app.models.user import User


class ActivityRepository:
    """Repository for retrieving recent platform activity from all tables."""

    @staticmethod
    def get_recent_activities(db: Session, limit: int = 3) -> list[dict]:
        """
        Get the most recent activities across all tables.

        For each table, compares created_at and updated_at to determine the most
        recent change, then merges all results and returns the N most recent overall.

        Args:
            db: Database session
            limit: Number of activities to return (default 3)

        Returns:
            List of dicts with: id, entity_type, description, timestamp (max of created_at/updated_at), operation
        """
        activities = []

        # Query users - get all and determine if created or updated more recently
        users = db.query(User).all()
        for user in users:
            # Determine which is more recent: created_at or updated_at
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

        # Query tenants
        tenants = db.query(Tenant).all()
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

        # Query orders
        orders = db.query(Order).all()
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

        # Query API keys
        api_keys = db.query(APIKey).all()
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

        # Sort by timestamp descending and return top N
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        return activities[:limit]


# Create singleton instance
activity_repository = ActivityRepository()
