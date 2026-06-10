"""Tests del proxy a messaging canned responses (create/update/delete)."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.messaging_service import MessagingService


@pytest.mark.asyncio
class TestCreateCannedResponse:
    """Proxy a POST /api/v1/canned_responses."""

    async def test_posts_payload_with_user_id(self):
        service = MessagingService()
        rails_payload = {"success": True, "data": {"id": 7, "short_code": "gracias", "content": "¡Gracias!"}}

        with patch.object(
            service, "_request", new=AsyncMock(return_value=rails_payload)
        ) as mock_req:
            result = await service.create_canned_response(
                tenant_id=1, user_id=99, payload={"short_code": "gracias", "content": "¡Gracias!"}
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "POST",
            "/api/v1/canned_responses",
            1,
            user_id="99",
            json_data={"canned_response": {"short_code": "gracias", "content": "¡Gracias!"}},
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.create_canned_response(
                tenant_id=1, user_id=99, payload={"short_code": "x", "content": "y"}
            )

        assert result is None


@pytest.mark.asyncio
class TestUpdateCannedResponse:
    """Proxy a PATCH /api/v1/canned_responses/:id."""

    async def test_patches_payload_with_user_id(self):
        service = MessagingService()
        rails_payload = {"success": True, "data": {"id": 7, "short_code": "saludo", "content": "editado"}}

        with patch.object(
            service, "_request", new=AsyncMock(return_value=rails_payload)
        ) as mock_req:
            result = await service.update_canned_response(
                tenant_id=1, user_id=99, canned_response_id=7, payload={"content": "editado"}
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "PATCH",
            "/api/v1/canned_responses/7",
            1,
            user_id="99",
            json_data={"canned_response": {"content": "editado"}},
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.update_canned_response(
                tenant_id=1, user_id=99, canned_response_id=7, payload={"content": "z"}
            )

        assert result is None


@pytest.mark.asyncio
class TestDeleteCannedResponse:
    """Proxy a DELETE /api/v1/canned_responses/:id."""

    async def test_deletes_with_user_id(self):
        service = MessagingService()

        with patch.object(
            service, "_request", new=AsyncMock(return_value={"success": True})
        ) as mock_req:
            result = await service.delete_canned_response(
                tenant_id=1, user_id=99, canned_response_id=7
            )

        assert result == {"success": True}
        mock_req.assert_awaited_once_with(
            "DELETE",
            "/api/v1/canned_responses/7",
            1,
            user_id="99",
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.delete_canned_response(
                tenant_id=1, user_id=99, canned_response_id=7
            )

        assert result is None
