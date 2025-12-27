"""
Metrics endpoints.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database
from app.models.user import User
from app.schemas.metrics import DashboardMetrics, MetricsQuery, PeriodType
from app.services.metrics import metrics_service

router = APIRouter()


@router.get("/dashboard", response_model=DashboardMetrics, tags=["metrics"])
async def get_dashboard_metrics(
    period: PeriodType = Query("today", description="Predefined period"),
    start_date: date | None = Query(None, description="Custom start date (required for period='custom')"),
    end_date: date | None = Query(None, description="Custom end date (required for period='custom')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> DashboardMetrics:
    """
    Get dashboard metrics for the current user's tenant with flexible date range.

    **Period options:**
    - `today`: Today's metrics
    - `yesterday`: Yesterday's metrics
    - `last_7_days`: Last 7 days
    - `last_30_days`: Last 30 days
    - `this_month`: Current month
    - `last_month`: Previous month
    - `custom`: Custom date range (requires start_date and end_date)

    **Metrics included:**
    - Total number of orders in the period
    - Orders pending payment (validado=False)
    - Orders pending dispatch (status='Pendiente')
    - Total sales amount (only validated orders)
    - Currency used in transactions
    - Actual date range used

    **Examples:**
    ```
    GET /api/v1/metrics/dashboard?period=today
    GET /api/v1/metrics/dashboard?period=last_7_days
    GET /api/v1/metrics/dashboard?period=this_month
    GET /api/v1/metrics/dashboard?period=custom&start_date=2025-12-01&end_date=2025-12-27
    ```

    All authenticated users can view metrics from their tenant.

    Args:
        period: Predefined period type
        start_date: Custom start date (only for period='custom')
        end_date: Custom end date (only for period='custom')
        current_user: Current authenticated user
        db: Database session

    Returns:
        DashboardMetrics with all dashboard statistics for the specified period

    Raises:
        HTTPException: If metrics retrieval fails or invalid parameters
    """
    try:
        # Create query object
        query = MetricsQuery(
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        # Get metrics
        metrics = metrics_service.get_dashboard_metrics(
            db,
            current_user.tenant_id,
            query
        )

        return metrics

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrics: {str(e)}",
        )
