"""Tests del service de distribución de conversaciones por tipo (IA / Humano / Abandonadas)."""

from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.metrics import MetricsQuery
from app.services import metrics as metrics_module
from app.services.messaging_service import messaging_service
from app.services.metrics import MetricsService


def _rails_ok(distribution: list[dict], total: int) -> tuple[dict, int]:
    return (
        {"success": True, "data": {"distribution": distribution, "total_conversations": total}},
        200,
    )


_SAMPLE = [
    {"category": "agent_ai", "count": 6, "percentage": 60.0, "total_hours": 12.0},
    {"category": "human_support", "count": 3, "percentage": 30.0, "total_hours": 40.0},
    {"category": "abandoned", "count": 1, "percentage": 10.0, "total_hours": 2.0},
]


@pytest.fixture(autouse=True)
def _clear_cache():
    """El cache es module-level; limpiarlo entre tests evita contaminación cruzada."""
    metrics_module._distribution_cache.clear()
    yield
    metrics_module._distribution_cache.clear()


@pytest.mark.asyncio
class TestGetConversationDistribution:
    """metrics_service.get_conversation_distribution."""

    async def test_returns_distribution_passthrough(self):
        service = MetricsService()
        with patch.object(
            messaging_service,
            "get_conversation_distribution",
            new=AsyncMock(return_value=_rails_ok(_SAMPLE, 10)),
        ):
            result = await service.get_conversation_distribution(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

        assert result["total_conversations"] == 10
        assert result["distribution"] == _SAMPLE

    async def test_cache_hit_skips_messaging(self):
        service = MetricsService()
        mock = AsyncMock(return_value=_rails_ok(_SAMPLE, 10))
        with patch.object(messaging_service, "get_conversation_distribution", new=mock):
            query = MetricsQuery(period="last_30_days")
            first = await service.get_conversation_distribution(tenant_id=7, query=query)
            second = await service.get_conversation_distribution(tenant_id=7, query=query)

        assert first == second
        assert mock.await_count == 1  # segunda llamada servida desde cache

    async def test_raises_when_messaging_unavailable(self):
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_conversation_distribution",
                new=AsyncMock(return_value=(None, 0)),
            ),
            pytest.raises(RuntimeError, match="unavailable"),
        ):
            await service.get_conversation_distribution(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_raises_on_messaging_5xx(self):
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_conversation_distribution",
                new=AsyncMock(return_value=({"error": "boom"}, 500)),
            ),
            pytest.raises(RuntimeError, match="error"),
        ):
            await service.get_conversation_distribution(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_raises_on_unexpected_status(self):
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_conversation_distribution",
                new=AsyncMock(return_value=({"error": "forbidden"}, 403)),
            ),
            pytest.raises(RuntimeError, match="Unexpected status"),
        ):
            await service.get_conversation_distribution(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_raises_on_invalid_response(self):
        """Rails responde 200 pero sin clave 'data' → RuntimeError."""
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_conversation_distribution",
                new=AsyncMock(return_value=({"success": True}, 200)),
            ),
            pytest.raises(RuntimeError, match="Invalid response"),
        ):
            await service.get_conversation_distribution(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_cross_tenant_uses_effective_tenant_and_flag(self):
        """SUPERADMIN cross-tenant: tenant_id=None → effective 1 + cross_tenant=True a Rails."""
        service = MetricsService()
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return _rails_ok([], 0)

        with patch.object(
            messaging_service, "get_conversation_distribution", side_effect=fake
        ):
            await service.get_conversation_distribution(
                tenant_id=None,
                query=MetricsQuery(period="last_30_days"),
                cross_tenant=True,
            )

        assert captured["tenant_id"] == 1  # effective_tenant_id cuando es None
        assert captured["cross_tenant"] is True
        assert isinstance(captured["start_date"], str)
        assert "T" in captured["start_date"]

    async def test_admin_uses_own_tenant_without_cross_tenant(self):
        service = MetricsService()
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return _rails_ok([], 0)

        with patch.object(
            messaging_service, "get_conversation_distribution", side_effect=fake
        ):
            await service.get_conversation_distribution(
                tenant_id=42, query=MetricsQuery(period="last_30_days")
            )

        assert captured["tenant_id"] == 42
        assert captured["cross_tenant"] is False

    async def test_cross_tenant_not_cached_as_same_key(self):
        """Dos requests con distinto cross_tenant no deben compartir entrada de cache."""
        service = MetricsService()
        cross = AsyncMock(return_value=_rails_ok(_SAMPLE, 99))
        single = AsyncMock(return_value=_rails_ok([], 0))
        query = MetricsQuery(period="last_30_days")

        # tenant_id=None con cross_tenant=True
        with patch.object(messaging_service, "get_conversation_distribution", new=cross):
            r_cross = await service.get_conversation_distribution(
                tenant_id=None, query=query, cross_tenant=True
            )
        # tenant_id=None con cross_tenant=False NO debe servir la entrada anterior
        with patch.object(messaging_service, "get_conversation_distribution", new=single):
            r_single = await service.get_conversation_distribution(
                tenant_id=None, query=query, cross_tenant=False
            )

        assert r_cross["total_conversations"] == 99
        assert r_single["total_conversations"] == 0
        assert single.await_count == 1  # se llamó a Rails, no hubo colisión de cache
