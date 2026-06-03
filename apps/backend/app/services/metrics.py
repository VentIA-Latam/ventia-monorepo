"""
Metrics service - business logic for dashboard metrics.
"""

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from cachetools import TTLCache
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

_activity_cache: TTLCache = TTLCache(maxsize=100, ttl=900)
_distribution_cache: TTLCache = TTLCache(maxsize=100, ttl=900)  # 15 min
_chats_started_cache: TTLCache = TTLCache(maxsize=100, ttl=300)  # 5 min (AC US-AUDIT-003)


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

    async def get_no_purchase_reasons(
        self,
        tenant_id: int,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
    ) -> dict:
        """KPI motivos de no compra para un período (proxy a messaging Rails).

        Raises:
            RuntimeError: If the messaging service is unreachable or returns
                a non-success status / malformed payload.
        """
        start_utc, end_utc = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name
        )

        messaging_result, status_code = await messaging_service.get_no_purchase_reasons(
            tenant_id=tenant_id,
            start_date=start_utc.isoformat(),
            end_date=end_utc.isoformat(),
        )

        if status_code == 0:
            logger.error(
                f"no_purchase_reasons_messaging_unavailable: tenant_id={tenant_id}"
            )
            raise RuntimeError("Messaging service unavailable")

        if status_code >= 500:
            logger.error(
                f"no_purchase_reasons_messaging_error: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Messaging service error (status {status_code})")

        if status_code not in (200, 201):
            logger.error(
                f"no_purchase_reasons_unexpected_status: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Unexpected status from messaging service: {status_code}")

        if not messaging_result or "data" not in messaging_result:
            logger.error(
                f"no_purchase_reasons_invalid_response: tenant_id={tenant_id}"
            )
            raise RuntimeError("Invalid response from messaging service")

        data = messaging_result["data"]
        total = data.get("total", 0)
        results = data.get("results", [])

        logger.info(
            f"no_purchase_reasons_computed: tenant_id={tenant_id} period={query.period} "
            f"total={total} reasons={len(results)}"
        )

        return {
            "total": total,
            "results": results,
            "period": query.period,
            "start_date": start_utc.date(),
            "end_date": end_utc.date(),
        }

    async def get_ads_summary(
        self,
        db: Session,
        tenant_id: int,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
    ) -> dict:
        """Aggregate conversations grouped by Meta ad in a period.

        Hybrid flow:
          1) Local DB: list of conversation_ids whose order was validated in the period.
          2) Messaging (Rails): POST that list + date range, get started/converted counts per ad.
          3) Compute conversion_rate per ad.

        Raises:
            RuntimeError: If the messaging service is unreachable or returns
                a non-success status / malformed payload.
        """
        start_utc, end_utc = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name
        )

        converted_ids = metrics_repository.get_validated_order_conversation_ids(
            db, tenant_id, start_utc, end_utc
        )

        messaging_result, status_code = await messaging_service.get_ads_summary(
            tenant_id=tenant_id,
            start_date=start_utc.isoformat(),
            end_date=end_utc.isoformat(),
            converted_conversation_ids=converted_ids,
        )

        if status_code == 0:
            logger.error(f"ads_summary_messaging_unavailable: tenant_id={tenant_id}")
            raise RuntimeError("Messaging service unavailable")

        if status_code >= 500:
            logger.error(
                f"ads_summary_messaging_error: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Messaging service error (status {status_code})")

        if status_code not in (200, 201):
            logger.error(
                f"ads_summary_unexpected_status: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Unexpected status from messaging service: {status_code}")

        if not messaging_result or "data" not in messaging_result:
            logger.error(f"ads_summary_invalid_response: tenant_id={tenant_id}")
            raise RuntimeError("Invalid response from messaging service")

        ads_raw = messaging_result["data"].get("ads", [])
        ads = []
        for row in ads_raw:
            ad_id = row.get("ad_id")
            if not ad_id:
                logger.warning(
                    f"ads_summary_skipped_malformed_row: tenant_id={tenant_id} row={row}"
                )
                continue
            started = row.get("started", 0)
            converted = row.get("converted", 0)
            rate = round(converted / started * 100, 2) if started > 0 else 0.0
            ads.append({
                "ad_id": ad_id,
                "headline": row.get("headline"),
                "image_url": row.get("image_url"),
                "source_url": row.get("source_url"),
                "channel": row.get("channel"),
                "conversations_started": started,
                "conversations_converted": converted,
                "conversion_rate": rate,
            })

        logger.info(
            f"ads_summary_computed: tenant_id={tenant_id} period={query.period} "
            f"ads={len(ads)} converted_ids={len(converted_ids)}"
        )

        return {
            "ads": ads,
            "total_ads": len(ads),
            "period": query.period,
            "start_date": start_utc.date(),
            "end_date": end_utc.date(),
        }


    async def get_activity_by_hour(
        self,
        tenant_id: int | None,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
        cross_tenant: bool = False,
    ) -> dict:
        start_utc, end_utc = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name
        )

        # Para períodos rolling, usar solo días completos (sin incluir hoy)
        # para evitar que el día actual aparezca con datos parciales en el heatmap.
        if query.period in ("last_7_days", "last_30_days"):
            tz = ZoneInfo(tz_name)
            yesterday_end = (datetime.now(tz) - timedelta(days=1)).replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            end_utc = yesterday_end.astimezone(timezone.utc).replace(tzinfo=None)

        cache_key = (tenant_id, str(start_utc), str(end_utc))
        if cache_key in _activity_cache:
            logger.info(f"activity_by_hour_cache_hit: tenant_id={tenant_id}")
            return _activity_cache[cache_key]

        effective_tenant_id = tenant_id or 1
        messaging_result, status_code = await messaging_service.get_activity_by_hour(
            tenant_id=effective_tenant_id,
            start_date=start_utc.isoformat(),
            end_date=end_utc.isoformat(),
            timezone=tz_name,
            cross_tenant=cross_tenant,
        )

        if status_code == 0:
            logger.error(f"activity_by_hour_messaging_unavailable: tenant_id={tenant_id}")
            raise RuntimeError("Messaging service unavailable")

        if status_code >= 500:
            logger.error(
                f"activity_by_hour_messaging_error: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Messaging service error (status {status_code})")

        if status_code not in (200, 201):
            logger.error(
                f"activity_by_hour_unexpected_status: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Unexpected status from messaging service: {status_code}")

        if not messaging_result or "data" not in messaging_result:
            logger.error(f"activity_by_hour_invalid_response: tenant_id={tenant_id}")
            raise RuntimeError("Invalid response from messaging service")

        data = messaging_result["data"]

        result = {
            "matrix": data.get("matrix", []),
            "max_count": data.get("max_count", 0),
            "period": query.period,
            "start_date": start_utc.date(),
            "end_date": end_utc.date(),
        }

        _activity_cache[cache_key] = result

        logger.info(
            f"activity_by_hour_computed: tenant_id={tenant_id} period={query.period} "
            f"max_count={result['max_count']}"
        )

        return result

    async def get_conversation_distribution(
        self,
        tenant_id: int | None,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
        cross_tenant: bool = False,
    ) -> dict:
        start_utc, end_utc = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name
        )

        # Para períodos rolling, usar solo días completos (sin incluir hoy) para
        # que el cache key sea estable durante el día. Sin esto, end_utc=now_local
        # cambia cada microsegundo y la cache nunca hace hit. Mismo patrón que
        # get_activity_by_hour.
        if query.period in ("last_7_days", "last_30_days"):
            tz = ZoneInfo(tz_name)
            yesterday_end = (datetime.now(tz) - timedelta(days=1)).replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            end_utc = yesterday_end.astimezone(timezone.utc).replace(tzinfo=None)

        cache_key = (tenant_id, cross_tenant, str(start_utc), str(end_utc))
        if cache_key in _distribution_cache:
            logger.info(f"conversation_distribution_cache_hit: tenant_id={tenant_id}")
            return _distribution_cache[cache_key]

        effective_tenant_id = tenant_id or 1
        messaging_result, status_code = await messaging_service.get_conversation_distribution(
            tenant_id=effective_tenant_id,
            start_date=start_utc.isoformat(),
            end_date=end_utc.isoformat(),
            cross_tenant=cross_tenant,
        )

        if status_code == 0:
            logger.error(f"conversation_distribution_messaging_unavailable: tenant_id={tenant_id}")
            raise RuntimeError("Messaging service unavailable")

        if status_code >= 500:
            logger.error(
                f"conversation_distribution_messaging_error: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Messaging service error (status {status_code})")

        if status_code not in (200, 201):
            logger.error(
                f"conversation_distribution_unexpected_status: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Unexpected status from messaging service: {status_code}")

        if not messaging_result or "data" not in messaging_result:
            logger.error(f"conversation_distribution_invalid_response: tenant_id={tenant_id}")
            raise RuntimeError("Invalid response from messaging service")

        data = messaging_result["data"]
        result = {
            "distribution": data.get("distribution", []),
            "total_conversations": data.get("total_conversations", 0),
        }

        _distribution_cache[cache_key] = result

        logger.info(
            f"conversation_distribution_computed: tenant_id={tenant_id} "
            f"total={result['total_conversations']}"
        )

        return result

    async def get_chats_started(
        self,
        tenant_id: int | None,
        query: MetricsQuery,
        tz_name: str = "America/Lima",
        inbox_id: int | None = None,
        cross_tenant: bool = False,
    ) -> dict:
        start_utc, end_utc = metrics_repository._get_date_range(
            query.period, query.start_date, query.end_date, tz_name
        )

        # Para períodos rolling, usar solo días completos (sin incluir hoy) para
        # que el cache key sea estable durante el día. Sin esto, end_utc=now_local
        # cambia cada microsegundo y la cache nunca hace hit. Mismo patrón que
        # get_activity_by_hour y get_conversation_distribution.
        if query.period in ("last_7_days", "last_30_days"):
            tz = ZoneInfo(tz_name)
            yesterday_end = (datetime.now(tz) - timedelta(days=1)).replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            end_utc = yesterday_end.astimezone(timezone.utc).replace(tzinfo=None)

        # tz_name forma parte de la key: la salida son días en zona local, así que
        # un cambio de timezone del tenant debe invalidar la entrada cacheada.
        cache_key = (tenant_id, cross_tenant, inbox_id, tz_name, str(start_utc), str(end_utc))
        if cache_key in _chats_started_cache:
            logger.info(f"chats_started_cache_hit: tenant_id={tenant_id}")
            return _chats_started_cache[cache_key]

        effective_tenant_id = tenant_id or 1
        # _get_date_range devuelve UTC *naive*; se marca como UTC-aware antes de
        # serializar para que Rails (Time.iso8601) no lo interprete como hora local
        # del contenedor si TZ != UTC.
        messaging_result, status_code = await messaging_service.get_chats_started(
            tenant_id=effective_tenant_id,
            start_date=start_utc.replace(tzinfo=timezone.utc).isoformat(),
            end_date=end_utc.replace(tzinfo=timezone.utc).isoformat(),
            timezone="UTC" if cross_tenant else tz_name,
            inbox_id=inbox_id,
            cross_tenant=cross_tenant,
        )

        if status_code == 0:
            logger.error(f"chats_started_messaging_unavailable: tenant_id={tenant_id}")
            raise RuntimeError("Messaging service unavailable")

        if status_code >= 500:
            logger.error(
                f"chats_started_messaging_error: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Messaging service error (status {status_code})")

        if status_code not in (200, 201):
            logger.error(
                f"chats_started_unexpected_status: tenant_id={tenant_id} status={status_code}"
            )
            raise RuntimeError(f"Unexpected status from messaging service: {status_code}")

        if not messaging_result or "data" not in messaging_result:
            logger.error(f"chats_started_invalid_response: tenant_id={tenant_id}")
            raise RuntimeError("Invalid response from messaging service")

        data = messaging_result["data"]
        result = {
            "results": data.get("results", []),
            "total": data.get("total", 0),
            "available_inboxes": data.get("available_inboxes", []),
        }

        _chats_started_cache[cache_key] = result

        logger.info(
            f"chats_started_computed: tenant_id={tenant_id} total={result['total']}"
        )

        return result


# Global service instance
metrics_service = MetricsService()
