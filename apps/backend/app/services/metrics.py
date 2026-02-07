"""
Metrics service - business logic for dashboard metrics.
"""

from sqlalchemy.orm import Session

from app.repositories.metrics import metrics_repository
from app.schemas.metrics import DashboardMetrics, MetricsQuery


class MetricsService:
    """Service for metrics-related business logic."""

    def get_dashboard_metrics(
        self,
        db: Session,
        tenant_id: int,
        query: MetricsQuery
    ) -> DashboardMetrics:
        """
        Get dashboard metrics for a tenant with flexible date range.

        Args:
            db: Database session
            tenant_id: Tenant ID
            query: MetricsQuery with period and/or custom dates

        Returns:
            DashboardMetrics with all dashboard statistics for the specified period
        """
        # Get actual date range for the period
        start, end = metrics_repository._get_date_range(
            query.period,
            query.start_date,
            query.end_date
        )

        # Get metrics with the same period parameters
        total_orders = metrics_repository.get_orders_count(
            db, tenant_id, query.period, query.start_date, query.end_date
        )

        pending_payment = metrics_repository.get_orders_count(
            db, tenant_id, query.period, query.start_date, query.end_date,
            validado_filter=False
        )

        pending_dispatch = metrics_repository.get_orders_count(
            db, tenant_id, query.period, query.start_date, query.end_date,
            status_filter="Pendiente"
        )

        total_sales = metrics_repository.get_sales_amount(
            db, tenant_id, query.period, query.start_date, query.end_date
        )

        # Get currency from tenant's orders
        currency = metrics_repository.get_tenant_currency(db, tenant_id)

        return DashboardMetrics(
            total_orders=int(total_orders),
            pending_payment=int(pending_payment),
            pending_dispatch=int(pending_dispatch),
            total_sales=float(total_sales),
            currency=currency,
            period=query.period,
            start_date=start.date(),
            end_date=end.date()
        )


# Global service instance
metrics_service = MetricsService()
