"""
Pydantic schemas package.

DTOs (Data Transfer Objects) for API requests and responses.
"""

from app.schemas.health import HealthResponse
from app.schemas.order import (
    OrderCreate,
    OrderListResponse,
    OrderResponse,
    OrderUpdate,
    OrderValidate,
)
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
]
