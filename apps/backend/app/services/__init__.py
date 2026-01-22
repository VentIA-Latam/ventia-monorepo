"""
Service layer package.

Business logic layer that orchestrates operations between API and repository layers.
"""

from app.services.activity import activity_service
from app.services.ecommerce import EcommerceService, ecommerce_service
from app.services.invoice import InvoiceService, invoice_service
from app.services.invoice_serie import InvoiceSerieService, invoice_serie_service
from app.services.order import OrderService, order_service
from app.services.stats import StatsService, stats_service
from app.services.user import UserService, user_service
from app.integrations.efact_client import EFactClient

__all__ = [
    # User
    "UserService",
    "user_service",
    # Order
    "OrderService",
    "order_service",
    # Invoice
    "InvoiceService",
    "invoice_service",
    # Invoice Serie
    "InvoiceSerieService",
    "invoice_serie_service",
    # E-commerce (unified)
    "EcommerceService",
    "ecommerce_service",
    # eFact
    "EFactClient",
    # Stats
    "StatsService",
    "stats_service",
    # Activity
    "activity_service",
]

