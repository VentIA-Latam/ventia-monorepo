"""
Order schemas.
"""

from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.schemas.invoice import InvoiceResponse
from app.schemas.tenant import TenantResponse

if TYPE_CHECKING:
    from app.schemas.invoice import InvoiceResponse


class LineItemBase(BaseModel):
    """Schema for a line item in an order."""

    sku: str = Field(..., description="Product SKU")
    product: str = Field(..., description="Product name")
    unitPrice: float = Field(..., gt=0, description="Unit price (must be > 0)")
    quantity: int = Field(..., gt=0, description="Quantity (must be > 0)")
    subtotal: float | None = Field(None, description="Subtotal (calculated if not provided)")


class OrderBase(BaseModel):
    """Base schema for Order with common fields."""

    customer_email: EmailStr = Field(..., description="Customer email")
    customer_name: str | None = Field(None, description="Customer name")
    customer_document_type: str | None = Field(
        None,
        description=(
            "Tipo de documento SUNAT (catálogo 06): "
            "1=DNI, 6=RUC, 4=Carnet extranjería, 7=Pasaporte, "
            "0=Sin documento, A=Cédula diplomática"
        )
    )
    customer_document_number: str | None = Field(
        None,
        description="Número de documento del cliente (8 dígitos para DNI, 11 para RUC)"
    )
    total_price: float | None = Field(None, description="Total price (calculated if not provided)")
    currency: str = Field(default="USD", description="Currency code")
    line_items: list[LineItemBase] | None = Field(None, description="Order line items (products)")
    payment_method: str | None = Field(None, description="Payment method")
    notes: str | None = Field(None, description="Additional notes")
    expected_delivery_date: datetime | None = Field(None, description="Expected delivery date of the order")
    dispatch_time_window: str | None = Field(None, description="Dispatch time window (e.g., '09:00-12:00')")
    shipping_address: str | None = Field(
        None,
        description="Shipping address: address1, city",
        max_length=500,
    )


class OrderCreate(OrderBase):
    """
    Schema for creating a new Order.

    Used by n8n when inserting orders from e-commerce platforms.
    The tenant_id is automatically set from the authenticated user's tenant (in API endpoints).
    For internal use (webhooks), tenant_id can be provided explicitly.

    Validation:
    - At least one of shopify_draft_order_id or woocommerce_order_id must be provided
    - Cannot provide both simultaneously (mutually exclusive)
    """

    tenant_id: int | None = Field(
        None, description="Tenant ID (optional - for internal use only, ignored in public endpoints)"
    )
    shopify_draft_order_id: str | None = Field(
        None, description="Shopify draft order ID (required if not WooCommerce)"
    )
    woocommerce_order_id: int | None = Field(
        None, description="WooCommerce order ID (required if not Shopify)"
    )

    @model_validator(mode="after")
    def validate_platform_id(self) -> "OrderCreate":
        """Ensure exactly one platform ID is provided."""
        has_shopify = self.shopify_draft_order_id is not None
        has_woocommerce = self.woocommerce_order_id is not None

        if not has_shopify and not has_woocommerce:
            raise ValueError(
                "Either shopify_draft_order_id or woocommerce_order_id must be provided"
            )

        if has_shopify and has_woocommerce:
            raise ValueError(
                "Cannot provide both shopify_draft_order_id and woocommerce_order_id. "
                "An order can only belong to one platform."
            )

        return self


class OrderUpdate(BaseModel):
    """Schema for updating an Order (all fields optional)."""

    customer_email: EmailStr | None = None
    customer_name: str | None = None
    customer_document_type: str | None = None
    customer_document_number: str | None = None
    total_price: float | None = Field(None, gt=0)
    currency: str | None = None
    line_items: list[LineItemBase] | None = None
    payment_method: str | None = None
    notes: str | None = None
    status: str | None = None
    shipping_address: str | None = None


class OrderValidate(BaseModel):
    """
    Schema for validating payment on an order.

    Used when user validates payment in frontend.
    """

    payment_method: str | None = Field(None, description="Payment method used")
    notes: str | None = Field(None, description="Additional validation notes")


class OrderCancel(BaseModel):
    """Schema for cancelling an order."""

    reason: str = Field(
        ...,
        description="Cancel reason (CUSTOMER | DECLINED | FRAUD | INVENTORY | STAFF | OTHER)",
    )
    restock: bool = Field(default=True, description="Restock inventory (Shopify completed orders only)")
    notify_customer: bool = Field(default=True, description="Notify customer of cancellation (Shopify completed orders only)")
    refund_method: str | None = Field(
        default="original",
        description="Refund method: original | store_credit | later (Shopify completed orders only)",
    )
    staff_note: str | None = Field(default=None, description="Internal staff note")


class OrderResponse(OrderBase):
    """
    Schema for Order response.

    **Tenant Information:**
    - `tenant` field is Optional[TenantResponse]
    - Populated automatically when order is retrieved via SQL join
    - For SUPERADMIN: includes full tenant info (id, name, slug, etc.)
    - For other roles: typically None (they only see orders from their own tenant)
    - Frontend can display tenant name/slug when available to show which customer the order belongs to

    **Invoice Information:**
    - `invoices` field is Optional[List[InvoiceResponse]]
    - Populated when order is retrieved with invoice eager loading
    - Contains all electronic invoices (facturas, boletas, NC, ND) for this order
    - Allows viewing complete invoicing history for the order

    **Fields:**
    - Standard order fields from OrderBase
    - id, tenant_id, shopify_draft_order_id, shopify_order_id
    - validado, validated_at, status
    - created_at, updated_at
    - tenant: Optional tenant details (populated on join)
    - invoices: Optional list of invoices for this order
    """

    id: int
    tenant_id: int
    shopify_draft_order_id: str | None
    shopify_order_id: str | None
    woocommerce_order_id: int | None = Field(None, description="WooCommerce order ID")
    source_platform: Literal["shopify", "woocommerce"] | None = Field(
        None, description="Source e-commerce platform"
    )
    validado: bool
    validated_at: datetime | None
    status: str
    created_at: datetime
    updated_at: datetime
    tenant: TenantResponse | None = Field(None, description="Optional tenant info (populated via join for SUPER_ADMIN)")
    invoices: list[InvoiceResponse] | None = Field(None, description="Optional list of invoices for this order (populated via eager loading)")

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
