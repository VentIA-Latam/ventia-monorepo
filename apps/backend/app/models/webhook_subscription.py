"""
Webhook subscription tracking for Shopify and WooCommerce.

Stores subscription IDs for webhooks created programmatically,
allowing us to manage (update/delete) them later.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class WebhookSubscription(Base):
    """
    Track webhook subscriptions created via API.

    Each row represents a webhook subscription created programmatically
    in Shopify or WooCommerce for a specific tenant and topic.

    Attributes:
        id: Primary key
        platform: Platform name ("shopify" or "woocommerce")
        tenant_id: Tenant that owns this subscription
        topic: Webhook topic/event type (e.g., "DRAFT_ORDERS_CREATE", "order.created")
        subscription_id: Platform-specific subscription ID
        callback_url: Full webhook callback URL
        created_at: When subscription was created
        last_verified_at: Last time we verified it still exists
    """

    __tablename__ = "webhook_subscriptions"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Platform and tenant
    platform = Column(String(20), nullable=False, index=True)  # "shopify" | "woocommerce"
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant = relationship("Tenant")

    # Webhook details
    topic = Column(String(50), nullable=False)  # "DRAFT_ORDERS_CREATE", "order.created"
    subscription_id = Column(String(200), nullable=False)  # Platform-specific ID
    callback_url = Column(String(500), nullable=False)  # Full webhook URL

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_verified_at = Column(DateTime, nullable=True)  # Last verification time

    # Composite indexes and constraints
    __table_args__ = (
        # Prevent duplicate subscriptions for same tenant/platform/topic
        UniqueConstraint("tenant_id", "platform", "topic", name="uq_tenant_platform_topic"),
        Index("ix_webhook_sub_tenant_platform", "tenant_id", "platform"),
    )

    def __repr__(self) -> str:
        """String representation of webhook subscription."""
        return (
            f"<WebhookSubscription(id={self.id}, platform={self.platform}, "
            f"tenant_id={self.tenant_id}, topic={self.topic})>"
        )
