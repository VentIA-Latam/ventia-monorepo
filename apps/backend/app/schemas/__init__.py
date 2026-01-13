"""
Pydantic schemas package.

DTOs (Data Transfer Objects) for API requests and responses.
"""

from app.schemas.activity import ActivityItem, RecentActivityResponse
from app.schemas.health import HealthResponse
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceSerieCreate,
    InvoiceSerieListResponse,
    InvoiceSerieResponse,
    InvoiceSerieUpdate,
    InvoiceUpdate,
    TicketStatusResponse,
)
from app.schemas.order import (
    OrderCreate,
    OrderListResponse,
    OrderResponse,
    OrderUpdate,
    OrderValidate,
)
from app.schemas.stats import StatsResponse
from app.schemas.tenant import TenantCreate, TenantResponse, TenantUpdate, TenantWithToken
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserWithTenant

__all__ = [
    # Health
    "HealthResponse",
    # Tenant
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    "TenantWithToken",
    # User
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserWithTenant",
    # Order
    "OrderCreate",
    "OrderUpdate",
    "OrderValidate",
    "OrderResponse",
    "OrderListResponse",
    # Invoice
    "InvoiceCreate",
    "InvoiceUpdate",
    "InvoiceResponse",
    "InvoiceListResponse",
    "TicketStatusResponse",
    # Invoice Serie
    "InvoiceSerieCreate",
    "InvoiceSerieUpdate",
    "InvoiceSerieResponse",
    "InvoiceSerieListResponse",
    # Stats
    "StatsResponse",
    # Activity
    "ActivityItem",
    "RecentActivityResponse",
]
