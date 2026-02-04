"""
Webhook schemas for Shopify and WooCommerce.

Defines Pydantic models for webhook payloads, event creation,
and processing results.
"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# SHOPIFY WEBHOOK SCHEMAS
# ============================================================================


class ShopifyDraftOrder(BaseModel):
    """Simplified Shopify draft order webhook payload."""

    id: int
    name: str = Field(..., description="Draft order name (e.g., '#D1')")
    email: str | None = None
    total_price: str = Field(..., description="Total price as string (e.g., '100.00')")
    currency: str = Field(default="PEN", description="Currency code")
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    customer: dict[str, Any] | None = None
    note: str | None = None
    tags: str | None = None


class ShopifyOrder(BaseModel):
    """Simplified Shopify order webhook payload."""

    id: int
    name: str = Field(..., description="Order name (e.g., '#1001')")
    email: str | None = None
    total_price: str
    currency: str = Field(default="PEN")
    financial_status: str = Field(..., description="Payment status (paid, pending, etc.)")
    fulfillment_status: str | None = None
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    customer: dict[str, Any] | None = None
    note: str | None = None
    tags: str | None = None
    cancelled_at: str | None = None


class ShopifyWebhookPayload(BaseModel):
    """Generic Shopify webhook payload wrapper."""

    data: dict[str, Any] = Field(..., description="Complete webhook payload")


# ============================================================================
# WOOCOMMERCE WEBHOOK SCHEMAS
# ============================================================================


class WooCommerceOrder(BaseModel):
    """Simplified WooCommerce order webhook payload."""

    id: int
    number: str = Field(..., description="Order number")
    status: str = Field(..., description="Order status (pending, processing, completed, etc.)")
    currency: str = Field(default="PEN")
    total: str = Field(..., description="Total amount as string")
    billing: dict[str, Any] = Field(..., description="Billing address")
    shipping: dict[str, Any] | None = None
    line_items: list[dict[str, Any]] = Field(default_factory=list)
    customer_note: str | None = None
    date_created: str
    date_modified: str
    date_paid: str | None = None


class WooCommerceWebhookPayload(BaseModel):
    """WooCommerce webhook payload."""

    data: dict[str, Any] = Field(..., description="Complete webhook payload")


# ============================================================================
# WEBHOOK EVENT LOGGING
# ============================================================================


class WebhookEventCreate(BaseModel):
    """Schema for creating webhook event log."""

    platform: Literal["shopify", "woocommerce"] = Field(..., description="Platform name")
    event_type: str = Field(..., description="Event type (e.g., 'draft_orders/create')")
    event_id: str | None = Field(None, description="Unique event ID from platform")
    tenant_id: int = Field(..., description="Tenant ID")
    payload: dict[str, Any] = Field(..., description="Complete webhook payload")
    headers: dict[str, Any] | None = Field(None, description="Request headers")
    signature_valid: bool = Field(default=False, description="Whether signature is valid")
    signature_header: str | None = Field(None, description="Received signature value")


class WebhookEventResponse(BaseModel):
    """Schema for webhook event response."""

    id: int
    platform: str
    event_type: str
    event_id: str | None
    tenant_id: int
    payload: dict[str, Any]
    signature_valid: bool
    processed: bool
    processed_at: datetime | None
    error: str | None
    order_id: int | None
    received_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# WEBHOOK PROCESSING RESULT
# ============================================================================


class WebhookProcessingResult(BaseModel):
    """Result of processing a webhook."""

    success: bool = Field(..., description="Whether processing succeeded")
    message: str = Field(..., description="Human-readable message")
    webhook_event_id: int = Field(..., description="ID of webhook event log")
    order_id: int | None = Field(None, description="ID of created/updated order")
    action: str = Field(
        ...,
        description="Action taken (created, updated, cancelled, ignored, error)",
    )


# ============================================================================
# WEBHOOK SUBSCRIPTION SCHEMAS (for future use)
# ============================================================================


class WebhookSubscriptionCreate(BaseModel):
    """Schema for creating webhook subscription record."""

    platform: Literal["shopify", "woocommerce"]
    tenant_id: int
    topic: str = Field(..., description="Webhook topic/event type")
    subscription_id: str = Field(..., description="Subscription ID from platform")
    callback_url: str = Field(..., description="Webhook callback URL")


class WebhookSubscriptionResponse(BaseModel):
    """Schema for webhook subscription response."""

    id: int
    platform: str
    tenant_id: int
    topic: str
    subscription_id: str
    callback_url: str
    created_at: datetime
    last_verified_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
