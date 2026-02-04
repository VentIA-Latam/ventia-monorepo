"""
Webhook subscription repository.

Provides data access layer for webhook subscriptions.
"""

from sqlalchemy.orm import Session

from app.models.webhook_subscription import WebhookSubscription
from app.repositories.base import CRUDBase


class WebhookSubscriptionRepository(CRUDBase[WebhookSubscription, dict, dict]):
    """
    Repository for webhook subscriptions.

    Provides methods for creating, querying, and managing webhook subscription records.
    """

    def get_by_tenant_platform(
        self, db: Session, tenant_id: int, platform: str
    ) -> list[WebhookSubscription]:
        """
        Get all webhook subscriptions for a tenant and platform.

        Args:
            db: Database session
            tenant_id: Tenant ID
            platform: Platform name ("shopify" or "woocommerce")

        Returns:
            List of webhook subscriptions
        """
        return (
            db.query(WebhookSubscription)
            .filter(
                WebhookSubscription.tenant_id == tenant_id,
                WebhookSubscription.platform == platform,
            )
            .all()
        )

    def get_by_tenant_platform_topic(
        self, db: Session, tenant_id: int, platform: str, topic: str
    ) -> WebhookSubscription | None:
        """
        Get webhook subscription by tenant, platform, and topic.

        Used to check if a subscription already exists before creating a new one.

        Args:
            db: Database session
            tenant_id: Tenant ID
            platform: Platform name
            topic: Webhook topic

        Returns:
            WebhookSubscription if found, None otherwise
        """
        return (
            db.query(WebhookSubscription)
            .filter(
                WebhookSubscription.tenant_id == tenant_id,
                WebhookSubscription.platform == platform,
                WebhookSubscription.topic == topic,
            )
            .first()
        )

    def delete_by_tenant_platform(
        self, db: Session, tenant_id: int, platform: str
    ) -> int:
        """
        Delete all webhook subscriptions for a tenant and platform.

        Args:
            db: Database session
            tenant_id: Tenant ID
            platform: Platform name

        Returns:
            Number of subscriptions deleted
        """
        result = (
            db.query(WebhookSubscription)
            .filter(
                WebhookSubscription.tenant_id == tenant_id,
                WebhookSubscription.platform == platform,
            )
            .delete()
        )
        db.commit()
        return result


# Global repository instance
webhook_subscription_repository = WebhookSubscriptionRepository(WebhookSubscription)
