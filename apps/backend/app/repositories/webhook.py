"""
Webhook event repository.

Provides data access layer for webhook events, including methods for
querying by event ID (idempotency) and finding unprocessed events.
"""

from sqlalchemy.orm import Session

from app.models.webhook import WebhookEvent
from app.repositories.base import CRUDBase
from app.schemas.webhook import WebhookEventCreate


class WebhookRepository(CRUDBase[WebhookEvent, WebhookEventCreate, None]):
    """
    Repository for webhook events.

    Provides methods for creating, querying, and managing webhook event records.
    """

    def get_by_event_id(
        self, db: Session, platform: str, event_id: str, event_type: str | None = None
    ) -> WebhookEvent | None:
        """
        Get webhook event by platform, event_id, and optionally event_type.

        Used for idempotency checking - prevents processing duplicate events.
        For platforms like Shopify where the same resource ID can appear in multiple
        event types (e.g., draft_orders/create and draft_orders/delete both use the
        draft order ID), it's important to also check the event_type.

        Args:
            db: Database session
            platform: Platform name ("shopify" or "woocommerce")
            event_id: Unique event ID from platform
            event_type: Optional event type/topic (e.g., "draft_orders/delete")

        Returns:
            WebhookEvent if found, None otherwise
        """
        query = db.query(WebhookEvent).filter(
            WebhookEvent.platform == platform,
            WebhookEvent.event_id == event_id,
        )

        if event_type:
            query = query.filter(WebhookEvent.event_type == event_type)

        return query.first()

    def get_unprocessed(
        self,
        db: Session,
        platform: str | None = None,
        limit: int = 100,
    ) -> list[WebhookEvent]:
        """
        Get unprocessed webhook events.

        Useful for retry mechanisms or background processing.

        Args:
            db: Database session
            platform: Optional platform filter
            limit: Maximum number of events to return (default: 100)

        Returns:
            List of unprocessed webhook events, ordered by received_at
        """
        query = db.query(WebhookEvent).filter(WebhookEvent.processed == False)

        if platform:
            query = query.filter(WebhookEvent.platform == platform)

        return query.order_by(WebhookEvent.received_at).limit(limit).all()

    def get_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[WebhookEvent]:
        """
        Get webhook events for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number of records to skip (pagination)
            limit: Maximum number of records to return

        Returns:
            List of webhook events for the tenant
        """
        return (
            db.query(WebhookEvent)
            .filter(WebhookEvent.tenant_id == tenant_id)
            .order_by(WebhookEvent.received_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_failed_events(
        self,
        db: Session,
        tenant_id: int | None = None,
        limit: int = 100,
    ) -> list[WebhookEvent]:
        """
        Get webhook events that failed processing.

        Useful for debugging and retry mechanisms.

        Args:
            db: Database session
            tenant_id: Optional tenant filter
            limit: Maximum number of events to return

        Returns:
            List of failed webhook events
        """
        query = db.query(WebhookEvent).filter(
            WebhookEvent.processed == True,
            WebhookEvent.error.isnot(None),
        )

        if tenant_id is not None:
            query = query.filter(WebhookEvent.tenant_id == tenant_id)

        return query.order_by(WebhookEvent.received_at.desc()).limit(limit).all()


# Global repository instance
webhook_repository = WebhookRepository(WebhookEvent)
