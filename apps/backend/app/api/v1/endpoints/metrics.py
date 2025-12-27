"""
Metrics endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database
from app.models.user import User
from app.schemas.metrics import DashboardMetrics
from app.services.metrics import metrics_service

router = APIRouter()


@router.get("/dashboard", response_model=DashboardMetrics, tags=["metrics"])
async def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> DashboardMetrics:
    """
    Get dashboard metrics for the current user's tenant.

    Returns comprehensive statistics including:
    - Total number of orders
    - Orders pending payment (validado=False)
    - Orders to dispatch (status='Pendiente')
    - Total sales for today
    - Total sales for current month
    - Currency used in transactions

    All authenticated users can view metrics from their tenant.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        DashboardMetrics with all dashboard statistics

    Raises:
        HTTPException: If metrics retrieval fails
    """
    try:
        metrics = metrics_service.get_dashboard_metrics(db, current_user.tenant_id)
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve metrics: {str(e)}",
        )
