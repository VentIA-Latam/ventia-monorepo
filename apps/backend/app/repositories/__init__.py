"""
Repository layer package.

Data access layer with CRUD operations.
"""

from app.repositories.base import CRUDBase
from app.repositories.order import OrderRepository, order_repository
from app.repositories.stats import StatsRepository, stats_repository
from app.repositories.tenant import TenantRepository, tenant_repository
from app.repositories.user import UserRepository, user_repository

__all__ = [
    # Base
    "CRUDBase",
    # Tenant
    "TenantRepository",
    "tenant_repository",
    # User
    "UserRepository",
    "user_repository",
    # Order
    "OrderRepository",
    "order_repository",
    # Stats
    "StatsRepository",
    "stats_repository",
]
