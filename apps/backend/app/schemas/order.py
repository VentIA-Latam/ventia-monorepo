"""
Order schemas.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.tenant import TenantResponse


class OrderBase(BaseModel):
    """Base schema for Order with common fields."""

    customer_email: EmailStr = Field(..., description="Customer email")
    customer_name: str | None = Field(None, description="Customer name")
    total_price: float = Field(..., gt=0, description="Total price (must be > 0)")
    currency: str = Field(default="USD", description="Currency code")
    line_items: list[dict[str, Any]] | None = Field(None, description="Order line items (products)")
    payment_method: str | None = Field(None, description="Payment method")
    notes: str | None = Field(None, description="Additional notes")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery date of the order")
    dispatch_time_window: str | None = Field(None, description="Dispatch time window (e.g., '09:00-12:00')")


class OrderCreate(OrderBase):
    """
    Schema for creating a new Order.

    Used by n8n when inserting draft orders.
    """

    tenant_id: int = Field(..., description="Tenant ID")
    shopify_draft_order_id: str = Field(..., description="Shopify draft order ID")


class OrderUpdate(BaseModel):
    """Schema for updating an Order (all fields optional)."""

    customer_email: EmailStr | None = None
    customer_name: str | None = None
    total_price: float | None = Field(None, gt=0)
    currency: str | None = None
    line_items: list[dict[str, Any]] | None = None
    payment_method: str | None = None
    notes: str | None = None
    status: str | None = None


class OrderValidate(BaseModel):
    """
    Schema for validating payment on an order.

    Used when user validates payment in frontend.
    """

    payment_method: str | None = Field(None, description="Payment method used")
    notes: str | None = Field(None, description="Additional validation notes")


class OrderResponse(OrderBase):
    """
    Schema for Order response.

    **Tenant Information:**
    - `tenant` field is Optional[TenantResponse]
    - Populated automatically when order is retrieved via SQL join
    - For SUPER_ADMIN: includes full tenant info (id, name, slug, etc.)
    - For other roles: typically None (they only see orders from their own tenant)
    - Frontend can display tenant name/slug when available to show which customer the order belongs to

    **Fields:**
    - Standard order fields from OrderBase
    - id, tenant_id, shopify_draft_order_id, shopify_order_id
    - validado, validated_at, status
    - created_at, updated_at
    - tenant: Optional tenant details (populated on join)
    """

    id: int
    tenant_id: int
    shopify_draft_order_id: str
    shopify_order_id: str | None
    validado: bool
    validated_at: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime
    tenant: Optional[TenantResponse] = Field(None, description="Optional tenant info (populated via join for SUPER_ADMIN)")

    model_config = ConfigDict(from_attributes=True)


class OrderListResponse(BaseModel):
    """Schema for paginated order list response."""

    total: int = Field(..., description="Total number of orders")
    items: list[OrderResponse] = Field(..., description="List of orders")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Number of items per page")

    model_config = ConfigDict(from_attributes=True)

class OrderMetrics(BaseModel):
    """Schema for order metrics."""

    total_pedidos: int = Field(..., description="Total number of orders")
    pendientes_pago: int = Field(..., description="Number of orders pending payment (validado=False)")
    por_despachar: int = Field(..., description="Number of orders to dispatch (status='Pendiente')")
    ventas_hoy: float = Field(..., description="Total sales for today")
    ventas_mes: float = Field(..., description="Total sales for current month")
    currency: str = Field(..., description="Currency code (USD, EUR, etc.)")

    model_config = ConfigDict(from_attributes=True)