"""
Metrics schemas - Pydantic models for metrics endpoints.
"""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

PeriodType = Literal[
    "today",
    "yesterday",
    "last_7_days",
    "last_30_days",
    "this_month",
    "last_month",
    "custom"
]


class MetricsQuery(BaseModel):
    """Query parameters for metrics."""

    period: PeriodType = "today"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator('end_date')
    @classmethod
    def validate_date_range(cls, v: Optional[date], info) -> Optional[date]:
        """Validate that end_date is after start_date."""
        if v and info.data.get('start_date') and v < info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class TopProduct(BaseModel):
    """Schema for a top-selling product."""

    product: str = Field(..., description="Product name")
    total_sold: int = Field(..., description="Total units sold")
    total_revenue: float = Field(..., description="Total revenue from this product")


class TopProductsResponse(BaseModel):
    """Response schema for top products endpoint."""

    data: list[TopProduct] = Field(..., description="List of top products")
    period: PeriodType = Field(..., description="Period type used")
    start_date: date = Field(..., description="Start date of the period")
    end_date: date = Field(..., description="End date of the period")


class CityOrderCount(BaseModel):
    """Schema for order count per city."""

    city: str = Field(..., description="City name")
    order_count: int = Field(..., description="Number of orders from this city")


class OrdersByCityResponse(BaseModel):
    """Response schema for orders by city endpoint."""

    data: list[CityOrderCount] = Field(..., description="List of cities with order counts")
    period: PeriodType = Field(..., description="Period type used")
    start_date: date = Field(..., description="Start date of the period")
    end_date: date = Field(..., description="End date of the period")


class DashboardMetrics(BaseModel):
    """Schema for dashboard metrics."""

    total_orders: int = Field(..., description="Total number of orders in the period")
    pending_payment: int = Field(..., description="Number of orders pending payment (validado=False)")
    total_sales: float = Field(..., description="Total sales amount in the period")
    currency: str = Field(..., description="Currency code (USD, EUR, etc.)")
    period: PeriodType = Field(..., description="Period type used for metrics")
    start_date: date = Field(..., description="Start date of the period")
    end_date: date = Field(..., description="End date of the period")

    model_config = {
        "json_schema_extra": {
            "example": {
                "total_orders": 1245,
                "pending_payment": 12,
                "total_sales": 4250.00,
                "currency": "PEN",
                "period": "today",
                "start_date": "2025-12-27",
                "end_date": "2025-12-27"
            }
        }
    }


class ConversionRateResponse(BaseModel):
    """Tasa de conversión del agente IA (US-CONV-004)."""

    conversion_rate: Optional[float] = Field(
        None,
        description="Porcentaje 0-100. None si no hay conversaciones en el periodo.",
    )
    conversions: int = Field(..., description="Conversaciones distintas con ≥1 venta validada en el periodo")
    total_conversations: int = Field(..., description="Total conversaciones creadas en el periodo")
    period: PeriodType
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


class SetNoPurchaseReasonRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Motivo de no compra (string libre, no vacío).")


class NoPurchaseReasonItem(BaseModel):
    """Item del ranking de motivos de no compra."""

    reason: str = Field(..., description="Motivo de no compra")
    count: int = Field(..., description="Conversaciones con este motivo")
    percentage: float = Field(..., description="Porcentaje del total (0-100)")

    model_config = ConfigDict(from_attributes=True)


class NoPurchaseReasonsResponse(BaseModel):
    """KPI motivos de no compra agrupados en un período."""

    total: int = Field(..., description="Total conversaciones con motivo registrado")
    results: list[NoPurchaseReasonItem] = Field(
        default_factory=list, description="Motivos ordenados desc por count"
    )
    period: PeriodType
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


class ActivityByHourResponse(BaseModel):
    """Distribución de mensajes por hora del día y día de semana (heatmap 7×24)."""

    matrix: list[list[int]] = Field(
        ..., description="Matriz 7×24: matrix[dow][hour] = count. dow 0=domingo, 6=sábado"
    )
    max_count: int = Field(..., description="Valor máximo en la matriz")
    period: PeriodType
    start_date: date
    end_date: date
    timezone_note: str | None = Field(
        None, description="'UTC' cuando SUPERADMIN consulta cross-tenant"
    )

    model_config = ConfigDict(from_attributes=True)


class AdSummaryItem(BaseModel):
    """Performance de un anuncio Meta (click-to-WhatsApp)."""

    ad_id: str = Field(..., description="Meta ad_id from referral.source_id")
    headline: str | None = Field(None, description="Most recent ad headline")
    image_url: str | None = Field(None, description="Most recent ad creative URL")
    source_url: str | None = Field(None, description="Short link to ad (fb.me/...)")
    conversations_started: int = Field(..., description="Conversaciones iniciadas desde este anuncio en el periodo")
    conversations_converted: int = Field(..., description="Conversaciones que generaron orden validada")
    conversion_rate: float = Field(..., description="Porcentaje 0-100")

    model_config = ConfigDict(from_attributes=True)


class AdsSummaryResponse(BaseModel):
    """Resumen de conversaciones agrupadas por anuncio de origen."""

    ads: list[AdSummaryItem] = Field(default_factory=list, description="Anuncios ordenados desc por started")
    total_ads: int = Field(..., description="Número de anuncios distintos en el periodo")
    period: PeriodType
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


class DistributionCategory(BaseModel):
    """Un bucket de la distribución de conversaciones por tipo de atención."""

    category: Literal["agent_ai", "human_support", "abandoned"]
    count: int = Field(..., description="Número de conversaciones en este bucket")
    percentage: float = Field(..., description="Porcentaje 0-100 sobre el total")
    total_hours: float = Field(..., description="Suma de duración de las conversaciones (horas)")

    model_config = ConfigDict(from_attributes=True)


class ConversationDistributionResponse(BaseModel):
    """Distribución de conversaciones por tipo: IA / Humano / Abandonadas."""

    distribution: list[DistributionCategory]
    total_conversations: int = Field(..., description="Total de conversaciones clasificadas (excluye campañas)")

    model_config = ConfigDict(from_attributes=True)
