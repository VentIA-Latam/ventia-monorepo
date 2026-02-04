"""
Webhook event logging for audit and debugging.

This module provides models for tracking webhook events received from
ecommerce platforms (Shopify, WooCommerce) for audit, debugging, and
duplicate prevention.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class WebhookEvent(Base):
    """
    Log de eventos de webhooks recibidos.

    Almacena cada webhook recibido para auditoría, debugging y prevención de duplicados.

    Attributes:
        id: Primary key
        platform: Platform name ("shopify" or "woocommerce")
        event_type: Event type (e.g., "draft_orders/create", "order.created")
        event_id: Unique event ID from platform (for idempotency)
        tenant_id: Tenant that owns this webhook
        payload: Complete webhook JSON payload
        headers: Request headers (for debugging)
        signature_valid: Whether HMAC signature was valid
        signature_header: Received signature value
        processed: Whether event has been processed
        processed_at: When event was processed
        error: Error message if processing failed
        order_id: Related order if applicable
        received_at: When webhook was received
    """

    __tablename__ = "webhook_events"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Platform identification
    platform = Column(String(20), nullable=False, index=True)  # "shopify" | "woocommerce"
    event_type = Column(String(50), nullable=False, index=True)  # "draft_orders/create", "order.created"
    event_id = Column(String(100), nullable=True, index=True)  # Unique ID from platform

    # Multitenant relationship
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant = relationship("Tenant")

    # Webhook payload and headers
    payload = Column(JSONB, nullable=False)  # Complete webhook JSON
    headers = Column(JSONB, nullable=True)  # Request headers for debugging

    # Signature validation
    signature_valid = Column(Boolean, nullable=False, default=False)
    signature_header = Column(String(500), nullable=True)  # Received signature

    # Processing status
    processed = Column(Boolean, nullable=False, default=False, index=True)
    processed_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)  # Error message if processing failed

    # Related order
    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    order = relationship("Order")

    # Timestamps
    received_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Composite indexes for performance
    __table_args__ = (
        Index("ix_webhook_tenant_platform", "tenant_id", "platform"),
        Index("ix_webhook_tenant_event", "tenant_id", "event_type"),
        Index("ix_webhook_event_id_unique", "platform", "event_id", "event_type", unique=True),
    )

    def __repr__(self) -> str:
        """String representation of webhook event."""
        return (
            f"<WebhookEvent(id={self.id}, platform={self.platform}, "
            f"event_type={self.event_type}, tenant_id={self.tenant_id}, "
            f"processed={self.processed})>"
        )
