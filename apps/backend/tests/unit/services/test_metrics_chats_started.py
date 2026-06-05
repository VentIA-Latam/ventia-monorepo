"""Tests del service de chats iniciados por día (US-AUDIT-003)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.endpoints import metrics as endpoint_metrics
from app.core.permissions import Role
from app.models.user import User
from app.schemas.metrics import MetricsQuery
from app.services import metrics as metrics_module
from app.services.messaging_service import messaging_service
from app.services.metrics import MetricsService


def _rails_ok(results: list[dict], total: int, inboxes: list[dict] | None = None) -> tuple[dict, int]:
    return (
        {
            "success": True,
            "data": {
                "results": results,
                "total": total,
                "available_inboxes": inboxes or [],
            },
        },
        200,
    )


_SAMPLE = [
    {"date": "2026-06-01", "count": 42},
    {"date": "2026-06-02", "count": 0},
    {"date": "2026-06-03", "count": 17},
]
_INBOXES = [{"id": 3, "name": "Ventas WhatsApp"}]


@pytest.fixture(autouse=True)
def _clear_cache():
    """El cache es module-level; limpiarlo entre tests evita contaminación cruzada."""
    metrics_module._chats_started_cache.clear()
    yield
    metrics_module._chats_started_cache.clear()


@pytest.mark.asyncio
class TestGetChatsStarted:
    """metrics_service.get_chats_started."""

    async def test_returns_series_passthrough(self):
        service = MetricsService()
        with patch.object(
            messaging_service,
            "get_chats_started",
            new=AsyncMock(return_value=_rails_ok(_SAMPLE, 59, _INBOXES)),
        ):
            result = await service.get_chats_started(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

        assert result["total"] == 59
        assert result["results"] == _SAMPLE
        assert result["available_inboxes"] == _INBOXES

    async def test_cache_hit_skips_messaging(self):
        service = MetricsService()
        mock = AsyncMock(return_value=_rails_ok(_SAMPLE, 59))
        with patch.object(messaging_service, "get_chats_started", new=mock):
            query = MetricsQuery(period="last_30_days")
            first = await service.get_chats_started(tenant_id=7, query=query)
            second = await service.get_chats_started(tenant_id=7, query=query)

        assert first == second
        assert mock.await_count == 1  # segunda llamada servida desde cache

    async def test_inbox_id_is_part_of_cache_key(self):
        """Mismo tenant/rango pero distinto inbox_id NO debe compartir entrada de cache."""
        service = MetricsService()
        all_inbox = AsyncMock(return_value=_rails_ok(_SAMPLE, 59))
        one_inbox = AsyncMock(return_value=_rails_ok([], 0))
        query = MetricsQuery(period="last_30_days")

        with patch.object(messaging_service, "get_chats_started", new=all_inbox):
            r_all = await service.get_chats_started(tenant_id=7, query=query)
        with patch.object(messaging_service, "get_chats_started", new=one_inbox):
            r_one = await service.get_chats_started(tenant_id=7, query=query, inbox_id=3)

        assert r_all["total"] == 59
        assert r_one["total"] == 0
        assert one_inbox.await_count == 1  # no colisionó con la entrada sin inbox

    async def test_inbox_id_propagated_to_messaging(self):
        service = MetricsService()
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return _rails_ok([], 0)

        with patch.object(messaging_service, "get_chats_started", side_effect=fake):
            await service.get_chats_started(
                tenant_id=42, query=MetricsQuery(period="last_30_days"), inbox_id=9
            )

        assert captured["inbox_id"] == 9
        assert captured["tenant_id"] == 42
        assert captured["cross_tenant"] is False

    async def test_raises_when_messaging_unavailable(self):
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_chats_started",
                new=AsyncMock(return_value=(None, 0)),
            ),
            pytest.raises(RuntimeError, match="unavailable"),
        ):
            await service.get_chats_started(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_raises_on_messaging_5xx(self):
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_chats_started",
                new=AsyncMock(return_value=({"error": "boom"}, 500)),
            ),
            pytest.raises(RuntimeError, match="error"),
        ):
            await service.get_chats_started(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_raises_on_unexpected_status(self):
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_chats_started",
                new=AsyncMock(return_value=({"error": "forbidden"}, 403)),
            ),
            pytest.raises(RuntimeError, match="Unexpected status"),
        ):
            await service.get_chats_started(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_raises_on_invalid_response(self):
        """Rails responde 200 pero sin clave 'data' → RuntimeError."""
        service = MetricsService()
        with (
            patch.object(
                messaging_service,
                "get_chats_started",
                new=AsyncMock(return_value=({"success": True}, 200)),
            ),
            pytest.raises(RuntimeError, match="Invalid response"),
        ):
            await service.get_chats_started(
                tenant_id=1, query=MetricsQuery(period="last_30_days")
            )

    async def test_cross_tenant_uses_effective_tenant_utc_and_flag(self):
        """SUPERADMIN cross-tenant: tenant_id=None → effective 1 + cross_tenant + tz UTC a Rails."""
        service = MetricsService()
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return _rails_ok([], 0)

        with patch.object(messaging_service, "get_chats_started", side_effect=fake):
            await service.get_chats_started(
                tenant_id=None,
                query=MetricsQuery(period="last_30_days"),
                cross_tenant=True,
            )

        assert captured["tenant_id"] == 1  # effective_tenant_id cuando es None
        assert captured["cross_tenant"] is True
        assert captured["timezone"] == "UTC"  # cross-tenant fuerza UTC
        assert isinstance(captured["start_date"], str)
        assert "T" in captured["start_date"]

    async def test_admin_uses_own_tenant_timezone(self):
        service = MetricsService()
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return _rails_ok([], 0)

        with patch.object(messaging_service, "get_chats_started", side_effect=fake):
            await service.get_chats_started(
                tenant_id=42,
                query=MetricsQuery(period="last_30_days"),
                tz_name="America/Lima",
            )

        assert captured["tenant_id"] == 42
        assert captured["cross_tenant"] is False
        assert captured["timezone"] == "America/Lima"


def _user(role: Role, tenant_id: int | None) -> User:
    user = MagicMock(spec=User)
    user.role = role
    user.tenant_id = tenant_id
    return user


@pytest.mark.asyncio
class TestChatsStartedEndpointAuthz:
    """Resolución de tenant en el endpoint (no-escalada de privilegios)."""

    async def _call(self, current_user: User, *, tenant_id=None, inbox_id=None):
        """Invoca la función del endpoint con metrics_service y tz mockeados."""
        svc = AsyncMock(return_value={"results": [], "total": 0, "available_inboxes": []})
        with (
            patch.object(endpoint_metrics.metrics_service, "get_chats_started", new=svc),
            patch.object(endpoint_metrics, "_get_tenant_timezone", return_value="America/Lima"),
        ):
            await endpoint_metrics.get_chats_started(
                period="last_30_days",
                start_date=None,
                end_date=None,
                tenant_id=tenant_id,
                inbox_id=inbox_id,
                current_user=current_user,
                db=MagicMock(),
            )
        return svc.await_args.kwargs

    async def test_admin_cannot_target_other_tenant(self):
        """Un ADMIN que pasa ?tenant_id ajeno es forzado a su propio tenant."""
        kwargs = await self._call(_user(Role.ADMIN, tenant_id=5), tenant_id=99)

        assert kwargs["tenant_id"] == 5  # ignora el 99 del query
        assert kwargs["cross_tenant"] is False

    async def test_non_admin_ignores_query_tenant(self):
        """VENTAS tampoco puede escalar vía tenant_id."""
        kwargs = await self._call(_user(Role.VENTAS, tenant_id=8), tenant_id=1)

        assert kwargs["tenant_id"] == 8
        assert kwargs["cross_tenant"] is False

    async def test_superadmin_without_tenant_uses_cross_tenant(self):
        kwargs = await self._call(_user(Role.SUPERADMIN, tenant_id=1), tenant_id=None)

        assert kwargs["tenant_id"] is None
        assert kwargs["cross_tenant"] is True
        assert kwargs["tz_name"] == "UTC"

    async def test_superadmin_with_tenant_targets_it(self):
        kwargs = await self._call(_user(Role.SUPERADMIN, tenant_id=1), tenant_id=7)

        assert kwargs["tenant_id"] == 7
        assert kwargs["cross_tenant"] is False
        assert kwargs["tz_name"] == "America/Lima"
