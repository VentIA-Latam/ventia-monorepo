"""
Metrics endpoints.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_permission_dual
from app.models.tenant import Tenant
from app.models.user import User
from app.core.permissions import Role
from app.schemas.metrics import (
    ActivityByHourResponse,
    AdsSummaryResponse,
    ConversationDistributionResponse,
    ConversionRateResponse,
    DashboardMetrics,
    MetricsQuery,
    NoPurchaseReasonsResponse,
    OrdersByCityResponse,
    PeriodType,
    SetNoPurchaseReasonRequest,
    TopProductsResponse,
)
from app.services.messaging_service import messaging_service
from app.services.metrics import metrics_service

router = APIRouter()


def _resolve_tenant_id(current_user: User) -> int:
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant assigned")
    return current_user.tenant_id


def _get_tenant_timezone(db: Session, tenant_id: int) -> str:
    """Get the IANA timezone configured for a tenant."""
    tenant = db.query(Tenant.timezone).filter(Tenant.id == tenant_id).first()
    return tenant[0] if tenant and tenant[0] else "America/Lima"


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
    Date calculations use the tenant's configured timezone.
    """
    try:
        query = MetricsQuery(
            period=period,
            start_date=start_date,
            end_date=end_date
        )

        tz_name = _get_tenant_timezone(db, current_user.tenant_id)

        metrics = metrics_service.get_dashboard_metrics(
            db,
            current_user.tenant_id,
            query,
            tz_name=tz_name,
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


@router.get("/top-products", response_model=TopProductsResponse, tags=["metrics"])
async def get_top_products(
    period: PeriodType = Query("last_30_days", description="Predefined period"),
    start_date: date | None = Query(None, description="Custom start date (required for period='custom')"),
    end_date: date | None = Query(None, description="Custom end date (required for period='custom')"),
    limit: int = Query(5, ge=1, le=50, description="Max number of products to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> TopProductsResponse:
    """Get top-selling products for the current user's tenant."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
        tz_name = _get_tenant_timezone(db, current_user.tenant_id)
        return metrics_service.get_top_products(
            db, current_user.tenant_id, query, limit, tz_name=tz_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve top products: {str(e)}",
        )


@router.get("/orders-by-city", response_model=OrdersByCityResponse, tags=["metrics"])
async def get_orders_by_city(
    period: PeriodType = Query("last_30_days", description="Predefined period"),
    start_date: date | None = Query(None, description="Custom start date (required for period='custom')"),
    end_date: date | None = Query(None, description="Custom end date (required for period='custom')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> OrdersByCityResponse:
    """Get order counts grouped by city for the current user's tenant."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
        tz_name = _get_tenant_timezone(db, current_user.tenant_id)
        return metrics_service.get_orders_by_city(
            db, current_user.tenant_id, query, tz_name=tz_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve orders by city: {str(e)}",
        )


@router.get("/conversion-rate", response_model=ConversionRateResponse, tags=["metrics"])
async def get_conversion_rate(
    period: PeriodType = Query("today"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> ConversionRateResponse:
    """Get AI agent conversion rate for a period (US-CONV-004)."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
        tz_name = _get_tenant_timezone(db, current_user.tenant_id)
        result = await metrics_service.get_conversion_rate(
            db, current_user.tenant_id, query, tz_name=tz_name
        )
        return ConversionRateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve conversion rate: {e}",
        )


@router.post(
    "/conversations/{conversation_id}/no-purchase-reason",
    summary="Registrar motivo de no compra (n8n)",
    status_code=200,
    tags=["metrics"],
)
async def set_no_purchase_reason(
    conversation_id: int,
    body: SetNoPurchaseReasonRequest,
    current_user: User = Depends(require_permission_dual("POST", "/metrics/*")),
) -> dict:
    tenant_id = _resolve_tenant_id(current_user)
    data, status_code = await messaging_service.set_no_purchase_reason(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        reason=body.reason,
    )
    if status_code == 0:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    if status_code == 404:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if status_code == 422:
        raise HTTPException(status_code=422, detail="Invalid reason")
    return data


@router.get(
    "/no-purchase-reasons",
    response_model=NoPurchaseReasonsResponse,
    summary="KPI motivos de no compra por rango de fechas",
    tags=["metrics"],
)
async def get_no_purchase_reasons(
    period: PeriodType = Query("custom"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
) -> NoPurchaseReasonsResponse:
    """Get no-purchase reasons KPI for the current user's tenant."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
        tz_name = _get_tenant_timezone(db, current_user.tenant_id)
        result = await metrics_service.get_no_purchase_reasons(
            tenant_id=current_user.tenant_id,
            query=query,
            tz_name=tz_name,
        )
        return NoPurchaseReasonsResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve no-purchase reasons: {e}",
        )


@router.get(
    "/ads-summary",
    response_model=AdsSummaryResponse,
    summary="Resumen de conversaciones agrupadas por anuncio Meta (click-to-WhatsApp)",
    tags=["metrics"],
)
async def get_ads_summary(
    period: PeriodType = Query("last_30_days"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
) -> AdsSummaryResponse:
    """Get ads performance summary for the current user's tenant."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)
        tz_name = _get_tenant_timezone(db, current_user.tenant_id)
        result = await metrics_service.get_ads_summary(
            db=db,
            tenant_id=current_user.tenant_id,
            query=query,
            tz_name=tz_name,
        )
        return AdsSummaryResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve ads summary: {e}",
        )


@router.get(
    "/activity-by-hour",
    response_model=ActivityByHourResponse,
    summary="Distribución de mensajes por hora del día y día de semana (heatmap 7×24)",
    tags=["metrics"],
)
async def get_activity_by_hour(
    period: PeriodType = Query("custom"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    tenant_id: int | None = Query(None, description="Tenant ID (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
) -> ActivityByHourResponse:
    """Get message activity distribution by hour and day of week."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)

        cross_tenant = False
        timezone_note = None

        if current_user.role == Role.SUPERADMIN:
            target_tenant = tenant_id
            if target_tenant is None:
                cross_tenant = True
                tz_name = "UTC"
                timezone_note = "UTC"
            else:
                tz_name = _get_tenant_timezone(db, target_tenant)
        else:
            target_tenant = current_user.tenant_id
            tz_name = _get_tenant_timezone(db, target_tenant)

        result = await metrics_service.get_activity_by_hour(
            tenant_id=target_tenant,
            query=query,
            tz_name=tz_name,
            cross_tenant=cross_tenant,
        )

        if timezone_note:
            result["timezone_note"] = timezone_note

        return ActivityByHourResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve activity by hour: {e}",
        )


@router.get(
    "/conversation-distribution",
    response_model=ConversationDistributionResponse,
    summary="Distribución de conversaciones por tipo (IA / Humano / Abandonadas)",
    tags=["metrics"],
)
async def get_conversation_distribution(
    period: PeriodType = Query("last_30_days"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    tenant_id: int | None = Query(None, description="Tenant ID (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
) -> ConversationDistributionResponse:
    """Get conversation distribution by attention type: AI, human, or abandoned."""
    try:
        query = MetricsQuery(period=period, start_date=start_date, end_date=end_date)

        cross_tenant = False

        if current_user.role == Role.SUPERADMIN:
            target_tenant = tenant_id
            if target_tenant is None:
                cross_tenant = True
                tz_name = "UTC"
            else:
                tz_name = _get_tenant_timezone(db, target_tenant)
        else:
            target_tenant = current_user.tenant_id
            tz_name = _get_tenant_timezone(db, target_tenant)

        result = await metrics_service.get_conversation_distribution(
            tenant_id=target_tenant,
            query=query,
            tz_name=tz_name,
            cross_tenant=cross_tenant,
        )

        return ConversationDistributionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve conversation distribution: {e}",
        )
