"""
Metrics repository - data access layer for metrics.
"""

from datetime import date, datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.order import Order


class MetricsRepository:
    """Repository for metrics-related database operations."""

    def _get_date_range(
        self,
        period: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[datetime, datetime]:
        """
        Convert period string to actual date range.

        Args:
            period: Period type (today, last_7_days, etc.)
            start_date: Custom start date (for period='custom')
            end_date: Custom end date (for period='custom')

        Returns:
            Tuple of (start_datetime, end_datetime)

        Raises:
            ValueError: If invalid period or missing dates for custom period
        """
        now = datetime.now()

        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == "yesterday":
            yesterday = now - timedelta(days=1)
            start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == "last_7_days":
            start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == "last_30_days":
            start = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == "this_month":
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == "last_month":
            first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_day_last_month = first_day_this_month - timedelta(days=1)
            start = last_day_last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end = last_day_last_month.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == "custom":
            if not start_date or not end_date:
                raise ValueError("start_date and end_date required for custom period")
            start = datetime.combine(start_date, datetime.min.time())
            end = datetime.combine(end_date, datetime.max.time())
        else:
            raise ValueError(f"Invalid period: {period}")

        return start, end

    def get_orders_count(
        self,
        db: Session,
        tenant_id: int,
        period: str = "today",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status_filter: Optional[str] = None,
        validado_filter: Optional[bool] = None
    ) -> int:
        """
        Get count of orders for a tenant in a date range.

        Args:
            db: Database session
            tenant_id: Tenant ID
            period: Period type
            start_date: Custom start date
            end_date: Custom end date
            status_filter: Optional status filter (e.g., "Pendiente")
            validado_filter: Optional validado filter (True/False)

        Returns:
            Count of orders
        """
        start, end = self._get_date_range(period, start_date, end_date)

        query = db.query(func.count(Order.id)).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= start,
            Order.created_at <= end
        )

        if status_filter is not None:
            query = query.filter(Order.status == status_filter)

        if validado_filter is not None:
            query = query.filter(Order.validado == validado_filter)

        return query.scalar() or 0

    def get_sales_amount(
        self,
        db: Session,
        tenant_id: int,
        period: str = "today",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> float:
        """
        Get total sales amount for a period.

        Args:
            db: Database session
            tenant_id: Tenant ID
            period: Period type
            start_date: Custom start date
            end_date: Custom end date

        Returns:
            Total sales amount
        """
        start, end = self._get_date_range(period, start_date, end_date)

        result = db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= start,
            Order.created_at <= end,
            Order.validado == True  # Solo órdenes validadas cuentan como ventas
        ).scalar()

        return float(result) if result else 0.0

    def get_tenant_currency(self, db: Session, tenant_id: int) -> str:
        """Get currency used by tenant (from their orders)."""
        currency = db.query(Order.currency).filter(
            Order.tenant_id == tenant_id
        ).first()
        return currency[0] if currency else "USD"


# Global repository instance
metrics_repository = MetricsRepository()
