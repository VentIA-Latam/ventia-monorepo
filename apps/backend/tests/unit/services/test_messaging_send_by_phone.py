"""Unit tests for messaging_service.send_by_phone proxy.

Spec: docs/superpowers/specs/2026-06-03-send-by-phone-endpoint-design.md
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.messaging_service import MessagingService


@pytest.mark.asyncio
class TestSendByPhone:
    """Proxy POST /api/v1/messages/send_by_phone hacia Rails messaging."""

    async def test_forwards_payload_flat_without_message_wrapper(self):
        service = MessagingService()
        rails_payload = {
            "success": True,
            "message": "Message sent",
            "data": {
                "conversation_id": 456,
                "message_id": 789,
                "contact_id": 123,
                "contact_created": True,
                "conversation_created": True,
            },
        }

        with patch.object(
            service, "_request", new=AsyncMock(return_value=rails_payload)
        ) as mock_req:
            payload = {
                "phone": "+51999888777",
                "inbox_id": 12,
                "template_params": {
                    "name": "promo_junio",
                    "language": "es",
                    "processed_params": {"body": {"1": "Juan"}},
                },
                "contact_name": "Juan Pérez",
            }
            result = await service.send_by_phone(tenant_id=1, payload=payload)

        assert result == rails_payload
        # Payload se pasa plano (no envuelto en {"message": ...})
        mock_req.assert_awaited_once_with(
            "POST",
            "/api/v1/messages/send_by_phone",
            1,
            user_id=None,
            json_data=payload,
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.send_by_phone(
                tenant_id=1, payload={"phone": "+51999888777", "inbox_id": 1, "template_params": {}}
            )
        assert result is None

    async def test_propagates_user_id_when_provided(self):
        service = MessagingService()
        with patch.object(
            service, "_request", new=AsyncMock(return_value={"success": True, "data": {}})
        ) as mock_req:
            await service.send_by_phone(
                tenant_id=1,
                payload={"phone": "+51999888777", "inbox_id": 1, "template_params": {}},
                user_id="user-42",
            )

        _, kwargs = mock_req.call_args
        assert kwargs["user_id"] == "user-42"
