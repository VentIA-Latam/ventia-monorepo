"""
Order model - represents orders from Shopify draft orders.
"""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Order(Base, TimestampMixin):
    """
    Order model - represents a Shopify draft order.

    Flow:
    1. n8n creates draft order in Shopify and inserts into this table
    2. User validates payment in frontend
    3. Backend calls Shopify GraphQL to complete the draft order
    """

    __tablename__ = "orders"

    # Multitenant
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Tenant (company) this order belongs to",
    )
    tenant = relationship("Tenant", back_populates="orders")

    # Shopify references
    shopify_draft_order_id = Column(
        String,
        index=True,
        nullable=False,
        comment="Shopify draft order ID (gid://shopify/DraftOrder/...)",
    )
    shopify_order_id = Column(
        String,
        index=True,
        nullable=True,
        comment="Shopify order ID after completion (gid://shopify/Order/...)",
    )

    # Order data (inserted by n8n)
    customer_email = Column(String, nullable=False, comment="Customer email address")
    customer_name = Column(String, nullable=True, comment="Customer full name")
    total_price = Column(Float, nullable=False, comment="Total order price")
    currency = Column(String, default="USD", nullable=False, comment="Currency code (USD, EUR, etc.)")
    line_items = Column(
        JSON,
        nullable=True,
        comment="Order line items (products) as JSON",
    )

    # Payment validation (managed by backend)
    validado = Column(
        Boolean,
        default=False,
        index=True,
        nullable=False,
        comment="Whether payment has been validated",
    )
    validated_at = Column(
        DateTime,
        nullable=True,
        comment="Timestamp when payment was validated",
    )
    payment_method = Column(String, nullable=True, comment="Payment method used")

    # Metadata
    notes = Column(String, nullable=True, comment="Additional notes about the order")
    status = Column(
        String,
        default="Pendiente",
        nullable=False,
        index=True,
        comment="Order status (Pagado, Pendiente, Enviado, Cancelado)",
    )

    # Delivery information
    expected_delivery_date = Column(
        DateTime,
        nullable=True,
        comment="Expected delivery date of the order",
    )
    dispatch_time_window = Column(
        String,
        nullable=True,
        comment="Dispatch time window (e.g., '09:00-12:00')",
    )

    # Unique constraint: one draft_order_id per tenant
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "shopify_draft_order_id",
            name="uq_tenant_draft_order",
        ),
    )

    def __repr__(self) -> str:
        """String representation of Order."""
        return (
            f"<Order(id={self.id}, tenant_id={self.tenant_id}, "
            f"customer='{self.customer_email}', total={self.total_price}, "
            f"validado={self.validado}, status='{self.status}')>"
        )
