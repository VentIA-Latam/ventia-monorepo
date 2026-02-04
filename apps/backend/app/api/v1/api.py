"""
API v1 router - aggregates all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import api_keys, health, invoices, invoice_series, metrics, orders, stats, tenants, users, webhooks


# Create main API router
api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, tags=["health"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(invoice_series.router, prefix="/invoice-series", tags=["invoice-series"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["api-keys"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
