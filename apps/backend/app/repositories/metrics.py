"""
Metrics repository - data access layer for metrics.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order import Order


class MetricsRepository:
    """Repository for metrics-related database operations."""

    def get_total_orders(self, db: Session, tenant_id: int) -> int:
        """Get total number of orders for a tenant."""
        return db.query(func.count(Order.id)).filter(
            Order.tenant_id == tenant_id
        ).scalar() or 0

    def get_pending_payment_count(self, db: Session, tenant_id: int) -> int:
        """Get count of orders pending payment (validado=False)."""
        return db.query(func.count(Order.id)).filter(
            Order.tenant_id == tenant_id,
            Order.validado == False
        ).scalar() or 0

    def get_pending_dispatch_count(self, db: Session, tenant_id: int) -> int:
        """Get count of orders to dispatch (status='Pendiente')."""
        return db.query(func.count(Order.id)).filter(
            Order.tenant_id == tenant_id,
            Order.status == "Pendiente"
        ).scalar() or 0

    def get_daily_sales(self, db: Session, tenant_id: int) -> float:
        """Get total sales for today."""
        today = date.today()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        return db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= today_start,
            Order.created_at <= today_end
        ).scalar() or 0.0

    def get_monthly_sales(self, db: Session, tenant_id: int) -> float:
        """Get total sales for current month."""
        from calendar import monthrange
        
        today = date.today()
        month_start = datetime(today.year, today.month, 1)
        
        # Obtener el último día del mes actual
        last_day_of_month = monthrange(today.year, today.month)[1]
        month_end = datetime(today.year, today.month, last_day_of_month, 23, 59, 59)
        
        return db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= month_start,
            Order.created_at <= month_end
        ).scalar() or 0.0

    def get_tenant_currency(self, db: Session, tenant_id: int) -> str:
        """Get currency used by tenant (from their orders)."""
        currency = db.query(Order.currency).filter(
            Order.tenant_id == tenant_id
        ).first()
        return currency[0] if currency else "USD"


# Global repository instance
metrics_repository = MetricsRepository()
