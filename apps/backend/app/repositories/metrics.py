"""
Metrics repository - data access layer for metrics.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional, Tuple

from zoneinfo import ZoneInfo

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.order import Order


class MetricsRepository:
    """Repository for metrics-related database operations."""

    def _get_date_range(
        self,
        period: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tz_name: str = "America/Lima",
    ) -> Tuple[datetime, datetime]:
        """
        Convert period string to actual date range in UTC.

        Calculates date boundaries in the tenant's timezone, then converts
        to naive UTC datetimes for querying against created_at (stored as UTC).

        Args:
            period: Period type (today, last_7_days, etc.)
            start_date: Custom start date (for period='custom')
            end_date: Custom end date (for period='custom')
            tz_name: IANA timezone name (e.g., 'America/Lima', 'America/Bogota')

        Returns:
            Tuple of (start_datetime, end_datetime) in naive UTC

        Raises:
            ValueError: If invalid period or missing dates for custom period
        """
        tz = ZoneInfo(tz_name)
        now_local = datetime.now(tz)

        if period == "today":
            start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
            end_local = now_local
        elif period == "yesterday":
            yesterday = now_local - timedelta(days=1)
            start_local = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
            end_local = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == "last_7_days":
            start_local = (now_local - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_local = now_local
        elif period == "last_30_days":
            start_local = (now_local - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
            end_local = now_local
        elif period == "this_month":
            start_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_local = now_local
        elif period == "last_month":
            first_day_this_month = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_day_last_month = first_day_this_month - timedelta(days=1)
            start_local = last_day_last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_local = last_day_last_month.replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == "custom":
            if not start_date or not end_date:
                raise ValueError("start_date and end_date required for custom period")
            start_local = datetime.combine(start_date, datetime.min.time(), tzinfo=tz)
            end_local = datetime.combine(end_date, datetime.max.time(), tzinfo=tz)
        else:
            raise ValueError(f"Invalid period: {period}")

        # Convert to naive UTC (to match created_at stored as naive UTC)
        start_utc = start_local.astimezone(timezone.utc).replace(tzinfo=None)
        end_utc = end_local.astimezone(timezone.utc).replace(tzinfo=None)

        return start_utc, end_utc

    def get_orders_count(
        self,
        db: Session,
        tenant_id: int,
        period: str = "today",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status_filter: Optional[str] = None,
        validado_filter: Optional[bool] = None,
        tz_name: str = "America/Lima",
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
            tz_name: IANA timezone for date calculations

        Returns:
            Count of orders
        """
        start, end = self._get_date_range(period, start_date, end_date, tz_name)

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
        end_date: Optional[date] = None,
        tz_name: str = "America/Lima",
    ) -> float:
        """
        Get total sales amount for a period.

        Args:
            db: Database session
            tenant_id: Tenant ID
            period: Period type
            start_date: Custom start date
            end_date: Custom end date
            tz_name: IANA timezone for date calculations

        Returns:
            Total sales amount
        """
        start, end = self._get_date_range(period, start_date, end_date, tz_name)

        result = db.query(func.sum(Order.total_price)).filter(
            Order.tenant_id == tenant_id,
            Order.created_at >= start,
            Order.created_at <= end,
            Order.validado == True  # Solo órdenes validadas cuentan como ventas
        ).scalar()

        return float(result) if result else 0.0

    def get_top_products(
        self,
        db: Session,
        tenant_id: int,
        period: str = "last_30_days",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 10,
        tz_name: str = "America/Lima",
    ) -> list[dict]:
        """
        Get top-selling products from line_items JSON field.

        Expands the JSON array using jsonb_array_elements and aggregates
        by product name. Excludes DELIVERY items.

        Returns:
            List of dicts with product, total_sold, total_revenue
        """
        start, end_dt = self._get_date_range(period, start_date, end_date, tz_name)

        query = text("""
            SELECT
                item->>'product' AS product,
                COALESCE(SUM((item->>'quantity')::int), 0) AS total_sold,
                COALESCE(SUM((item->>'subtotal')::float), 0) AS total_revenue
            FROM orders,
                 jsonb_array_elements(line_items::jsonb) AS item
            WHERE orders.tenant_id = :tenant_id
              AND orders.created_at >= :start
              AND orders.created_at <= :end
              AND UPPER(item->>'sku') != 'DELIVERY'
              AND item->>'product' IS NOT NULL
            GROUP BY item->>'product'
            ORDER BY total_sold DESC
            LIMIT :limit
        """)

        result = db.execute(query, {
            "tenant_id": tenant_id,
            "start": start,
            "end": end_dt,
            "limit": limit,
        })

        return [
            {"product": row[0], "total_sold": int(row[1]), "total_revenue": float(row[2])}
            for row in result
        ]

    def get_orders_by_city(
        self,
        db: Session,
        tenant_id: int,
        period: str = "last_30_days",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tz_name: str = "America/Lima",
    ) -> list[dict]:
        """
        Get order counts grouped by shipping_city.

        Returns:
            List of dicts with city and order_count
        """
        start, end_dt = self._get_date_range(period, start_date, end_date, tz_name)

        result = (
            db.query(
                Order.shipping_city,
                func.count(Order.id).label("order_count"),
            )
            .filter(
                Order.tenant_id == tenant_id,
                Order.created_at >= start,
                Order.created_at <= end_dt,
                Order.shipping_city.isnot(None),
                Order.shipping_city != "",
            )
            .group_by(Order.shipping_city)
            .order_by(func.count(Order.id).desc())
            .all()
        )

        return [
            {"city": row[0], "order_count": row[1]}
            for row in result
        ]

    def get_tenant_currency(self, db: Session, tenant_id: int) -> str:
        """Get currency used by tenant (from their orders)."""
        currency = db.query(Order.currency).filter(
            Order.tenant_id == tenant_id
        ).first()
        return currency[0] if currency else "USD"


# Global repository instance
metrics_repository = MetricsRepository()
