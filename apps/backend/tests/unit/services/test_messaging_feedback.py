"""Tests del proxy de feedback de IA (like/dislike) y su gate de permisos."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.messaging import export_message_feedback
from app.core.permissions import Role, can_access
from app.services.messaging_service import MessagingService


def _mock_user(role: Role = Role.ADMIN, tenant_id: int = 1) -> MagicMock:
    user = MagicMock()
    user.id = 10
    user.role = role
    user.tenant_id = tenant_id
    return user


@pytest.mark.asyncio
class TestMessageFeedbackProxy:
    """Proxy a los endpoints de feedback en Rails."""

    async def test_set_feedback_forwards_put_with_user_id(self):
        service = MessagingService()
        payload = {"rating": "dislike", "comment": "Precio inventado"}

        with patch.object(
            service, "_request", new=AsyncMock(return_value={"success": True, "data": {"rating": "dislike"}})
        ) as mock_req:
            result = await service.set_message_feedback(
                tenant_id=1,
                conversation_id="45",
                message_id="123",
                payload=payload,
                user_id="7",
            )

        assert result["data"]["rating"] == "dislike"
        mock_req.assert_awaited_once_with(
            "PUT",
            "/api/v1/conversations/45/messages/123/feedback",
            1,
            user_id="7",
            json_data=payload,
        )

    async def test_delete_feedback_forwards_delete(self):
        service = MessagingService()

        with patch.object(
            service, "_request", new=AsyncMock(return_value={"success": True})
        ) as mock_req:
            result = await service.delete_message_feedback(
                tenant_id=1, conversation_id="45", message_id="123", user_id="7"
            )

        assert result == {"success": True}
        mock_req.assert_awaited_once_with(
            "DELETE",
            "/api/v1/conversations/45/messages/123/feedback",
            1,
            user_id="7",
        )

    async def test_export_returns_text_and_status(self):
        service = MessagingService()

        class _Resp:
            text = '{"message_id":1,"rating":"like"}'
            status_code = 200

        with patch("httpx.AsyncClient") as mock_client:
            instance = mock_client.return_value.__aenter__.return_value
            instance.request = AsyncMock(return_value=_Resp())
            text, status = await service.export_message_feedback(tenant_id=1, params={"rating": "like"})

        assert status == 200
        assert "like" in text


class TestFeedbackPermissions:
    """El gate de roles para feedback y export (URL real → can_access)."""

    PUT_PATH = "/api/v1/messaging/conversations/123/messages/456/feedback"
    EXPORT_PATH = "/api/v1/messaging/feedback/export"

    def test_agents_can_vote(self):
        for method in ("PUT", "DELETE"):
            assert can_access(Role.SUPERADMIN, method, self.PUT_PATH)
            assert can_access(Role.ADMIN, method, self.PUT_PATH)
            assert can_access(Role.VENTAS, method, self.PUT_PATH)

    def test_viewer_cannot_vote(self):
        assert not can_access(Role.VIEWER, "PUT", self.PUT_PATH)

    def test_export_restricted_to_admins(self):
        assert can_access(Role.SUPERADMIN, "GET", self.EXPORT_PATH)
        assert can_access(Role.ADMIN, "GET", self.EXPORT_PATH)
        assert not can_access(Role.VENTAS, "GET", self.EXPORT_PATH)
        assert not can_access(Role.VIEWER, "GET", self.EXPORT_PATH)


@pytest.mark.asyncio
class TestExportEndpoint:
    """Endpoint de export: override de tenant, propagación de errores y éxito."""

    async def _call(self, **kwargs):
        defaults = dict(
            rating=None, inbox_id=None, from_=None, to=None, context=None,
            tenant_id=None, current_user=_mock_user(),
        )
        defaults.update(kwargs)
        return await export_message_feedback(**defaults)

    async def test_non_superadmin_tenant_override_is_forbidden(self):
        with pytest.raises(HTTPException) as exc:
            await self._call(tenant_id=99, current_user=_mock_user(role=Role.ADMIN, tenant_id=1))
        assert exc.value.status_code == 403

    async def test_superadmin_can_override_tenant(self):
        with patch(
            "app.api.v1.endpoints.messaging.messaging_service.export_message_feedback",
            new=AsyncMock(return_value=('{"rating":"like"}', 200)),
        ):
            resp = await self._call(tenant_id=99, current_user=_mock_user(role=Role.SUPERADMIN))
        assert resp.media_type == "application/x-ndjson"
        assert "ai_feedback_dataset.jsonl" in resp.headers["content-disposition"]

    async def test_error_body_is_truncated(self):
        with patch(
            "app.api.v1.endpoints.messaging.messaging_service.export_message_feedback",
            new=AsyncMock(return_value=("x" * 1000, 500)),
        ):
            with pytest.raises(HTTPException) as exc:
                await self._call()
        assert exc.value.status_code == 500
        assert len(exc.value.detail) <= 500

    async def test_network_failure_returns_503(self):
        with patch(
            "app.api.v1.endpoints.messaging.messaging_service.export_message_feedback",
            new=AsyncMock(return_value=(None, 0)),
        ):
            with pytest.raises(HTTPException) as exc:
                await self._call()
        assert exc.value.status_code == 503
