"""
Order model - represents orders from e-commerce platforms (Shopify, WooCommerce).
"""

from typing import Literal

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Order(Base, TimestampMixin):
    """
    Order model - represents an order from an e-commerce platform.

    Supports multiple platforms:
    - Shopify: Uses shopify_draft_order_id (string, GraphQL ID format)
    - WooCommerce: Uses woocommerce_order_id (integer)

    Flow:
    1. n8n creates order in e-commerce platform and inserts into this table
    2. User validates payment in frontend
    3. Backend calls e-commerce API to mark order as paid/complete
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
        nullable=True,
        comment="Shopify draft order ID (gid://shopify/DraftOrder/...)",
    )
    shopify_order_id = Column(
        String,
        index=True,
        nullable=True,
        comment="Shopify order ID after completion (gid://shopify/Order/...)",
    )

    # WooCommerce references
    woocommerce_order_id = Column(
        Integer,
        index=True,
        nullable=True,
        comment="WooCommerce order ID (integer)",
    )

    # Customer document fields for invoicing
    customer_document_type = Column(
        String(1),
        nullable=True,
        comment="Tipo de documento: 1=DNI, 6=RUC",
    )
    customer_document_number = Column(
        String(11),
        nullable=True,
        comment="Número de DNI o RUC del cliente",
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
    shipping_address = Column(
        Text,
        nullable=True,
        comment="Shipping address: address1, city",
    )

    # Structured shipping data (extracted from e-commerce platform)
    shipping_city = Column(
        String,
        nullable=True,
        comment="Shipping city",
    )
    shipping_province = Column(
        String,
        nullable=True,
        comment="Shipping province/state",
    )
    shipping_country = Column(
        String,
        nullable=True,
        comment="Country name (e.g., 'Peru', 'United States')",
    )

    # Sales channel
    channel = Column(
        String,
        nullable=True,
        index=True,
        comment="Sales channel: shopify, woocommerce, venta_whatsapp",
    )

    # Messaging conversation link (cross-database reference, NOT a FK)
    messaging_conversation_id = Column(
        Integer,
        nullable=True,
        index=True,
        comment="Linked conversation ID in the messaging service",
    )

    # Relationships
    invoices = relationship("Invoice", back_populates="order", cascade="all, delete-orphan")

    # Unique constraints: one order ID per tenant per platform
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "shopify_draft_order_id",
            name="uq_tenant_draft_order",
        ),
        UniqueConstraint(
            "tenant_id",
            "woocommerce_order_id",
            name="uq_tenant_woo_order",
        ),
    )

    @property
    def source_platform(self) -> Literal["shopify", "woocommerce"] | None:
        """
        Get the source e-commerce platform for this order.

        Returns:
            'shopify' if shopify_draft_order_id exists,
            'woocommerce' if woocommerce_order_id exists,
            None if neither exists.
        """
        if self.shopify_draft_order_id:
            return "shopify"
        if self.woocommerce_order_id:
            return "woocommerce"
        return None

    def __repr__(self) -> str:
        """String representation of Order."""
        return (
            f"<Order(id={self.id}, tenant_id={self.tenant_id}, "
            f"customer='{self.customer_email}', total={self.total_price}, "
            f"validado={self.validado}, status='{self.status}', "
            f"platform='{self.source_platform}')>"
        )
