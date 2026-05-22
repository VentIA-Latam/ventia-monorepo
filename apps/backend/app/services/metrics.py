"""
Metrics service - business logic for dashboard metrics.
"""

import logging

from sqlalchemy.orm import Session

from app.repositories.metrics import metrics_repository
from app.schemas.metrics import (
    CityOrderCount,
    DashboardMetrics,
    MetricsQuery,
    OrdersByCityResponse,
    TopProduct,
    TopProductsResponse,
)
from app.services.messaging_service import messaging_service

logger = logging.getLogger(__name__)


class MetricsService:
    """Service for metrics-related business logic."""

    def get_dashboard_metrics(
        self,
        db: Session,
        tenant_id: int,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
    ) -> DashboardMetrics:
        """
        Get dashboard metrics for a tenant with flexible date range.

        Args:
            db: Database session
            tenant_id: Tenant ID
            query: MetricsQuery with period and/or custom dates
            tz_name: IANA timezone for date calculations

        Returns:
            DashboardMetrics with all dashboard statistics for the specified period
        """
        # Get actual date range for the period
        start, end = metrics_repository._get_date_range(
            query.period,
            query.start_date,
            query.end_date,
            tz_name,
        )

        # Get metrics with the same period parameters
        total_orders = metrics_repository.get_orders_count(
            db, tenant_id, query.period, query.start_date, query.end_date,
            tz_name=tz_name,
        )

        pending_payment = metrics_repository.get_orders_count(
            db, tenant_id, query.period, query.start_date, query.end_date,
            status_filter="Pendiente", tz_name=tz_name,
        )

        total_sales = metrics_repository.get_sales_amount(
            db, tenant_id, query.period, query.start_date, query.end_date,
            tz_name=tz_name,
        )

        # Get currency from tenant's orders
        currency = metrics_repository.get_tenant_currency(db, tenant_id)

        return DashboardMetrics(
            total_orders=int(total_orders),
            pending_payment=int(pending_payment),
            total_sales=float(total_sales),
            currency=currency,
            period=query.period,
            start_date=start.date(),
            end_date=end.date()
        )

    def get_top_products(
        self,
        db: Session,
        tenant_id: int,
        query: MetricsQuery,
        limit: int = 10,
        tz_name: str = "America/Lima",
    ) -> TopProductsResponse:
        """Get top-selling products for a tenant."""
        start, end = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name,
        )

        rows = metrics_repository.get_top_products(
            db, tenant_id, query.period, query.start_date, query.end_date,
            limit, tz_name=tz_name,
        )

        return TopProductsResponse(
            data=[TopProduct(**row) for row in rows],
            period=query.period,
            start_date=start.date(),
            end_date=end.date(),
        )

    def get_orders_by_city(
        self,
        db: Session,
        tenant_id: int,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
    ) -> OrdersByCityResponse:
        """Get order counts grouped by city for a tenant."""
        start, end = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name,
        )

        rows = metrics_repository.get_orders_by_city(
            db, tenant_id, query.period, query.start_date, query.end_date,
            tz_name=tz_name,
        )

        return OrdersByCityResponse(
            data=[CityOrderCount(**row) for row in rows],
            period=query.period,
            start_date=start.date(),
            end_date=end.date(),
        )

    async def get_conversion_rate(
        self,
        db: Session,
        tenant_id: int,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
    ) -> dict:
        """Compute AI agent conversion rate for US-CONV-004.

        Numerator: distinct conversations with a validated order in the period
                   (local orders DB query — no cross-DB list passing).
        Denominator: total conversations created in the period
                     (messaging service — US-CONV-003 endpoint).

        Rate is capped at 100 to handle edge case where an old conversation
        has its order validated in the current period.

        Raises:
            RuntimeError: If the messaging service call fails.
        """
        start_utc, end_utc = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name
        )

        converted = metrics_repository.get_converted_conversations_count(
            db, tenant_id, start_utc, end_utc
        )

        messaging_result = await messaging_service.get_conversations_count_by_period(
            tenant_id=tenant_id,
            start_date=start_utc.isoformat(),
            end_date=end_utc.isoformat(),
        )

        if not messaging_result or "data" not in messaging_result:
            logger.error(f"conversion_rate_messaging_failed: tenant_id={tenant_id}")
            raise RuntimeError("Could not fetch conversations count from messaging service")

        total = messaging_result["data"].get("total", 0)
        rate = min(round(converted / total * 100, 1), 100.0) if total > 0 else None

        logger.info(
            f"conversion_rate_computed: tenant_id={tenant_id} period={query.period} "
            f"total={total} converted={converted} rate={rate}"
        )

        return {
            "conversion_rate": rate,
            "conversions": converted,
            "total_conversations": total,
            "period": query.period,
            "start_date": start_utc.date(),
            "end_date": end_utc.date(),
        }


# Global service instance
metrics_service = MetricsService()
