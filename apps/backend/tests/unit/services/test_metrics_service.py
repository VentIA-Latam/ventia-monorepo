"""US-CONV-004: Tests del service de tasa de conversión."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.repositories.metrics import metrics_repository
from app.schemas.metrics import MetricsQuery
from app.services.messaging_service import messaging_service
from app.services.metrics import MetricsService


@pytest.mark.asyncio
class TestGetConversionRate:
    """metrics_service.get_conversion_rate."""

    def _messaging_ok(self, total: int) -> dict:
        return {
            "success": True,
            "data": {
                "total": total,
                "period": {
                    "start_date": "2026-04-01T00:00:00+00:00",
                    "end_date": "2026-04-30T23:59:59+00:00",
                },
            },
        }

    async def test_returns_correct_rate(self):
        service = MetricsService()
        with (
            patch.object(metrics_repository, "get_converted_conversations_count", return_value=25),
            patch.object(
                messaging_service,
                "get_conversations_count_by_period",
                new=AsyncMock(return_value=self._messaging_ok(100)),
            ),
        ):
            result = await service.get_conversion_rate(
                MagicMock(), tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

        assert result["conversion_rate"] == 25.0
        assert result["conversions"] == 25
        assert result["total_conversations"] == 100

    async def test_returns_none_rate_when_no_conversations(self):
        service = MetricsService()
        with (
            patch.object(metrics_repository, "get_converted_conversations_count", return_value=0),
            patch.object(
                messaging_service,
                "get_conversations_count_by_period",
                new=AsyncMock(return_value=self._messaging_ok(0)),
            ),
        ):
            result = await service.get_conversion_rate(
                MagicMock(), tenant_id=1, query=MetricsQuery(period="today")
            )

        assert result["conversion_rate"] is None
        assert result["conversions"] == 0
        assert result["total_conversations"] == 0

    async def test_caps_rate_at_100(self):
        """Converted > total (old conversation with order validated in current period)."""
        service = MetricsService()
        with (
            patch.object(metrics_repository, "get_converted_conversations_count", return_value=5),
            patch.object(
                messaging_service,
                "get_conversations_count_by_period",
                new=AsyncMock(return_value=self._messaging_ok(3)),
            ),
        ):
            result = await service.get_conversion_rate(
                MagicMock(), tenant_id=1, query=MetricsQuery(period="today")
            )

        assert result["conversion_rate"] == 100.0

    async def test_raises_runtime_error_when_messaging_fails(self):
        service = MetricsService()
        with (
            patch.object(metrics_repository, "get_converted_conversations_count", return_value=0),
            patch.object(
                messaging_service,
                "get_conversations_count_by_period",
                new=AsyncMock(return_value=None),
            ),
        ):
            with pytest.raises(RuntimeError, match="messaging service"):
                await service.get_conversion_rate(
                    MagicMock(), tenant_id=1, query=MetricsQuery(period="today")
                )

    async def test_raises_runtime_error_when_messaging_returns_no_data_key(self):
        """Messaging returns a response without 'data' key (e.g. success=False)."""
        service = MetricsService()
        with (
            patch.object(metrics_repository, "get_converted_conversations_count", return_value=0),
            patch.object(
                messaging_service,
                "get_conversations_count_by_period",
                new=AsyncMock(return_value={"success": False, "message": "Not found"}),
            ),
        ):
            with pytest.raises(RuntimeError, match="messaging service"):
                await service.get_conversion_rate(
                    MagicMock(), tenant_id=1, query=MetricsQuery(period="today")
                )
