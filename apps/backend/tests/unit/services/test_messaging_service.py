"""US-CONV-003: Tests del proxy a messaging analytics."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.messaging_service import MessagingService


@pytest.mark.asyncio
class TestGetConversationsCountByPeriod:
    """Proxy a GET /api/v1/analytics/conversations_count."""

    async def test_returns_rails_payload_on_success(self):
        service = MessagingService()
        rails_payload = {
            "success": True,
            "data": {
                "total": 42,
                "period": {
                    "start_date": "2026-04-01T00:00:00+00:00",
                    "end_date": "2026-04-29T23:59:59+00:00",
                },
            },
        }

        with patch.object(
            service, "_request", new=AsyncMock(return_value=rails_payload)
        ) as mock_req:
            result = await service.get_conversations_count_by_period(
                tenant_id=1,
                start_date="2026-04-01T00:00:00+00:00",
                end_date="2026-04-29T23:59:59+00:00",
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "GET",
            "/api/v1/analytics/conversations_count",
            1,
            user_id=None,
            params={
                "start_date": "2026-04-01T00:00:00+00:00",
                "end_date": "2026-04-29T23:59:59+00:00",
            },
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.get_conversations_count_by_period(
                tenant_id=1,
                start_date="2026-04-01T00:00:00+00:00",
                end_date="2026-04-29T23:59:59+00:00",
            )

        assert result is None

    async def test_propagates_user_id_when_provided(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value={})) as mock_req:
            await service.get_conversations_count_by_period(
                tenant_id=1,
                start_date="2026-04-01T00:00:00+00:00",
                end_date="2026-04-29T23:59:59+00:00",
                user_id="user-123",
            )

        assert mock_req.await_args.kwargs["user_id"] == "user-123"
