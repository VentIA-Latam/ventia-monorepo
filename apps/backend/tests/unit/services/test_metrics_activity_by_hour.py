"""Tests del service de actividad por hora (heatmap DOW×HOUR)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

from app.schemas.metrics import MetricsQuery
from app.services import metrics as metrics_module
from app.services.messaging_service import messaging_service
from app.services.metrics import MetricsService


@pytest.fixture(autouse=True)
def _clear_activity_cache():
    """Cada test arranca con cache vacío para evitar contaminación cruzada."""
    metrics_module._activity_cache.clear()
    yield
    metrics_module._activity_cache.clear()


def _matrix_with_one(dow: int, hour: int, count: int = 5) -> list[list[int]]:
    m = [[0] * 24 for _ in range(7)]
    m[dow][hour] = count
    return m


def _rails_ok(matrix: list[list[int]], max_count: int) -> tuple[dict, int]:
    return ({"success": True, "data": {"matrix": matrix, "max_count": max_count}}, 200)


@pytest.mark.asyncio
class TestGetActivityByHour:
    """metrics_service.get_activity_by_hour."""

    async def test_returns_matrix_and_max_count(self):
        service = MetricsService()
        matrix = _matrix_with_one(dow=3, hour=15, count=7)
        with patch.object(
            messaging_service,
            "get_activity_by_hour",
            new=AsyncMock(return_value=_rails_ok(matrix, 7)),
        ):
            result = await service.get_activity_by_hour(
                tenant_id=1, query=MetricsQuery(period="last_7_days")
            )

        assert result["matrix"][3][15] == 7
        assert result["max_count"] == 7
        assert result["period"] == "last_7_days"

    async def test_cache_hit_does_not_call_messaging_twice(self):
        service = MetricsService()
        matrix = _matrix_with_one(dow=3, hour=15)
        mock_messaging = AsyncMock(return_value=_rails_ok(matrix, 5))
        with patch.object(messaging_service, "get_activity_by_hour", new=mock_messaging):
            await service.get_activity_by_hour(
                tenant_id=1, query=MetricsQuery(period="last_7_days")
            )
            await service.get_activity_by_hour(
                tenant_id=1, query=MetricsQuery(period="last_7_days")
            )

        assert mock_messaging.call_count == 1

    async def test_cache_separa_por_tenant_id(self):
        """Tenant 1 no debe ver la data cacheada del tenant 2 ni viceversa."""
        service = MetricsService()
        matrix_a = _matrix_with_one(dow=1, hour=10, count=100)
        matrix_b = _matrix_with_one(dow=4, hour=20, count=200)

        async def fake_get(*, tenant_id, **kw):
            if tenant_id == 1:
                return _rails_ok(matrix_a, 100)
            return _rails_ok(matrix_b, 200)

        with patch.object(messaging_service, "get_activity_by_hour", side_effect=fake_get):
            r1 = await service.get_activity_by_hour(
                tenant_id=1, query=MetricsQuery(period="last_7_days")
            )
            r2 = await service.get_activity_by_hour(
                tenant_id=2, query=MetricsQuery(period="last_7_days")
            )

        assert r1["max_count"] == 100
        assert r2["max_count"] == 200
        assert r1["matrix"][1][10] == 100
        assert r2["matrix"][4][20] == 200

    async def test_cache_separa_supertenant_none_de_tenant_concreto(self):
        """SUPERADMIN cross-tenant (tenant_id=None) tiene cache key propio."""
        service = MetricsService()
        matrix_concreto = _matrix_with_one(dow=2, hour=10, count=50)
        matrix_global   = _matrix_with_one(dow=2, hour=10, count=500)
        calls: list[int | None] = []

        async def fake_get(*, tenant_id, **kw):
            calls.append(kw.get("cross_tenant"))
            return _rails_ok(matrix_global, 500) if kw.get("cross_tenant") else _rails_ok(matrix_concreto, 50)

        with patch.object(messaging_service, "get_activity_by_hour", side_effect=fake_get):
            r_concreto = await service.get_activity_by_hour(
                tenant_id=1, query=MetricsQuery(period="last_7_days"), cross_tenant=False
            )
            r_global = await service.get_activity_by_hour(
                tenant_id=None, query=MetricsQuery(period="last_7_days"), cross_tenant=True
            )

        assert r_concreto["max_count"] == 50
        assert r_global["max_count"] == 500
        # Verifica que ambas llamadas ocurrieron (no hubo cache hit cruzado)
        assert calls == [False, True]

    async def test_rolling_window_excluye_dia_actual(self):
        """Para last_7_days el end_utc se debe ajustar a ayer 23:59:59 en tz local."""
        service = MetricsService()
        captured: dict = {}

        async def capture(*, tenant_id, start_date, end_date, **kw):
            captured["start"] = start_date
            captured["end"] = end_date
            return _rails_ok(_matrix_with_one(0, 0, 0), 0)

        with patch.object(messaging_service, "get_activity_by_hour", side_effect=capture):
            await service.get_activity_by_hour(
                tenant_id=1, query=MetricsQuery(period="last_7_days"), tz_name="America/Lima"
            )

        # El end_date enviado al messaging debe corresponder a ayer 23:59:59 Lima → UTC
        end_iso = captured["end"]
        end_dt = datetime.fromisoformat(end_iso)
        # Ayer 23:59:59 Lima = ayer 04:59:59 UTC del día siguiente (UTC-5)
        now_lima = datetime.now(ZoneInfo("America/Lima"))
        yesterday_end_lima = (now_lima - timedelta(days=1)).replace(
            hour=23, minute=59, second=59, microsecond=999999
        )
        expected_end_utc = yesterday_end_lima.astimezone(timezone.utc).replace(tzinfo=None)
        # Tolerancia de ±2 segundos por el momento de ejecución
        assert abs((end_dt - expected_end_utc).total_seconds()) < 2

    async def test_status_0_messaging_unreachable_raises(self):
        service = MetricsService()
        with patch.object(
            messaging_service, "get_activity_by_hour",
            new=AsyncMock(return_value=(None, 0)),
        ):
            with pytest.raises(RuntimeError, match="unavailable"):
                await service.get_activity_by_hour(
                    tenant_id=1, query=MetricsQuery(period="last_7_days")
                )

    async def test_status_500_raises(self):
        service = MetricsService()
        with patch.object(
            messaging_service, "get_activity_by_hour",
            new=AsyncMock(return_value=({"error": "boom"}, 500)),
        ):
            with pytest.raises(RuntimeError, match="error"):
                await service.get_activity_by_hour(
                    tenant_id=1, query=MetricsQuery(period="last_7_days")
                )

    async def test_unexpected_status_raises(self):
        service = MetricsService()
        with patch.object(
            messaging_service, "get_activity_by_hour",
            new=AsyncMock(return_value=({"x": 1}, 418)),
        ):
            with pytest.raises(RuntimeError, match="Unexpected"):
                await service.get_activity_by_hour(
                    tenant_id=1, query=MetricsQuery(period="last_7_days")
                )

    async def test_invalid_payload_raises(self):
        service = MetricsService()
        with patch.object(
            messaging_service, "get_activity_by_hour",
            new=AsyncMock(return_value=({"success": True}, 200)),  # falta "data"
        ):
            with pytest.raises(RuntimeError, match="Invalid response"):
                await service.get_activity_by_hour(
                    tenant_id=1, query=MetricsQuery(period="last_7_days")
                )

    async def test_pasa_cross_tenant_flag_al_messaging(self):
        service = MetricsService()
        captured: dict = {}

        async def capture(**kw):
            captured.update(kw)
            return _rails_ok(_matrix_with_one(0, 0, 0), 0)

        with patch.object(messaging_service, "get_activity_by_hour", side_effect=capture):
            await service.get_activity_by_hour(
                tenant_id=None, query=MetricsQuery(period="last_7_days"),
                tz_name="UTC", cross_tenant=True,
            )

        assert captured["cross_tenant"] is True
        # tenant_id=None debe traducirse a effective_tenant_id=1 al llamar al messaging
        assert captured["tenant_id"] == 1
        assert captured["timezone"] == "UTC"
