"""
Metrics schemas - Pydantic models for metrics endpoints.
"""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


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
