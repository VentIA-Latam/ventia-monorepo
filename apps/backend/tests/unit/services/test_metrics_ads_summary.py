"""Tests del service de resumen de conversaciones por anuncio Meta."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.repositories.metrics import metrics_repository
from app.schemas.metrics import MetricsQuery
from app.services.messaging_service import messaging_service
from app.services.metrics import MetricsService


@pytest.mark.asyncio
class TestGetAdsSummary:
    """metrics_service.get_ads_summary."""

    def _rails_ok(self, ads: list[dict]) -> tuple[dict, int]:
        return ({"success": True, "data": {"ads": ads}}, 200)

    async def test_returns_empty_when_no_ads(self):
        service = MetricsService()
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=self._rails_ok([])),
            ),
        ):
            result = await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

        assert result["ads"] == []
        assert result["total_ads"] == 0

    async def test_calculates_conversion_rate_correctly(self):
        service = MetricsService()
        ads_payload = [
            {
                "ad_id": "120243814566250320",
                "headline": "Tu descanso no espera",
                "image_url": "https://img.test/a.png",
                "source_url": "https://fb.me/x",
                "channel": "instagram",
                "started": 5,
                "converted": 3,
            }
        ]
        with (
            patch.object(
                metrics_repository,
                "get_validated_order_conversation_ids",
                return_value=[10, 20, 30],
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=self._rails_ok(ads_payload)),
            ),
        ):
            result = await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

        ad = result["ads"][0]
        assert ad["ad_id"] == "120243814566250320"
        assert ad["channel"] == "instagram"
        assert ad["conversations_started"] == 5
        assert ad["conversations_converted"] == 3
        assert ad["conversion_rate"] == 60.0
        assert result["total_ads"] == 1

    async def test_zero_started_returns_zero_rate(self):
        service = MetricsService()
        ads_payload = [
            {
                "ad_id": "x",
                "headline": None,
                "image_url": None,
                "source_url": None,
                "started": 0,
                "converted": 0,
            }
        ]
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=self._rails_ok(ads_payload)),
            ),
        ):
            result = await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

        assert result["ads"][0]["conversion_rate"] == 0.0

    async def test_handles_null_metadata_fields(self):
        service = MetricsService()
        ads_payload = [
            {
                "ad_id": "ad_xyz",
                "started": 2,
                "converted": 1,
            }
        ]
        with (
            patch.object(
                metrics_repository,
                "get_validated_order_conversation_ids",
                return_value=[1],
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=self._rails_ok(ads_payload)),
            ),
        ):
            result = await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

        ad = result["ads"][0]
        assert ad["headline"] is None
        assert ad["image_url"] is None
        assert ad["source_url"] is None

    async def test_raises_when_messaging_unavailable(self):
        service = MetricsService()
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=(None, 0)),
            ),
            pytest.raises(RuntimeError, match="unavailable"),
        ):
            await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

    async def test_raises_on_messaging_5xx(self):
        service = MetricsService()
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=({"error": "boom"}, 500)),
            ),
            pytest.raises(RuntimeError, match="error"),
        ):
            await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

    async def test_passes_converted_ids_to_messaging(self):
        service = MetricsService()
        captured = {}

        async def fake_get_ads_summary(**kwargs):
            captured.update(kwargs)
            return ({"success": True, "data": {"ads": []}}, 200)

        with (
            patch.object(
                metrics_repository,
                "get_validated_order_conversation_ids",
                return_value=[101, 202, 303],
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                side_effect=fake_get_ads_summary,
            ),
        ):
            await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=42,
                query=MetricsQuery(period="last_30_days"),
            )

        assert captured["tenant_id"] == 42
        assert captured["converted_conversation_ids"] == [101, 202, 303]
        # Date range debe propagarse a Rails como ISO strings.
        assert isinstance(captured["start_date"], str)
        assert isinstance(captured["end_date"], str)
        assert "T" in captured["start_date"]  # ISO 8601 with time component

    async def test_raises_on_invalid_response(self):
        """Rails responde 200 pero sin clave 'data' → RuntimeError."""
        service = MetricsService()
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=({"success": True}, 200)),
            ),
            pytest.raises(RuntimeError, match="Invalid response"),
        ):
            await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

    async def test_raises_on_unexpected_status(self):
        """Rails responde con status 4xx no esperado → RuntimeError."""
        service = MetricsService()
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=({"error": "forbidden"}, 403)),
            ),
            pytest.raises(RuntimeError, match="Unexpected status"),
        ):
            await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

    async def test_skips_malformed_rows_without_ad_id(self):
        """Filas sin ad_id se loguean y skippean sin reventar la response."""
        service = MetricsService()
        ads_payload = [
            {"ad_id": "good_ad", "started": 3, "converted": 1},
            {"started": 5, "converted": 2},  # falta ad_id
            {"ad_id": None, "started": 1, "converted": 0},  # ad_id null
        ]
        with (
            patch.object(
                metrics_repository, "get_validated_order_conversation_ids", return_value=[]
            ),
            patch.object(
                messaging_service,
                "get_ads_summary",
                new=AsyncMock(return_value=self._rails_ok(ads_payload)),
            ),
        ):
            result = await service.get_ads_summary(
                db=MagicMock(),
                tenant_id=1,
                query=MetricsQuery(period="last_30_days"),
            )

        assert result["total_ads"] == 1
        assert result["ads"][0]["ad_id"] == "good_ad"
