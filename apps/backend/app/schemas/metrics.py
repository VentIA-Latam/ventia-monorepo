"""
Metrics schemas.
"""

from pydantic import BaseModel, Field


class DashboardMetrics(BaseModel):
    """Schema for dashboard metrics."""

    total_pedidos: int = Field(..., description="Total number of orders")
    pendientes_pago: int = Field(..., description="Number of orders pending payment (validado=False)")
    por_despachar: int = Field(..., description="Number of orders to dispatch (status='Pendiente')")
    ventas_hoy: float = Field(..., description="Total sales for today")
    ventas_mes: float = Field(..., description="Total sales for current month")
    currency: str = Field(..., description="Currency code (USD, EUR, etc.)")
