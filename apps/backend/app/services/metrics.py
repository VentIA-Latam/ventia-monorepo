"""
Metrics service - business logic for dashboard metrics.
"""

from sqlalchemy.orm import Session

from app.repositories.metrics import metrics_repository
from app.schemas.metrics import DashboardMetrics


class MetricsService:
    """Service for metrics-related business logic."""

    def get_dashboard_metrics(self, db: Session, tenant_id: int) -> DashboardMetrics:
        """
        Get dashboard metrics for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            DashboardMetrics with all dashboard statistics
        """
        total_pedidos = metrics_repository.get_total_orders(db, tenant_id)
        pendientes_pago = metrics_repository.get_pending_payment_count(db, tenant_id)
        por_despachar = metrics_repository.get_pending_dispatch_count(db, tenant_id)
        ventas_hoy = metrics_repository.get_daily_sales(db, tenant_id)
        ventas_mes = metrics_repository.get_monthly_sales(db, tenant_id)
        currency = metrics_repository.get_tenant_currency(db, tenant_id)

        return DashboardMetrics(
            total_pedidos=int(total_pedidos),
            pendientes_pago=int(pendientes_pago),
            por_despachar=int(por_despachar),
            ventas_hoy=float(ventas_hoy),
            ventas_mes=float(ventas_mes),
            currency=currency,
        )


# Global service instance
metrics_service = MetricsService()
