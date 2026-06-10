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


@pytest.mark.asyncio
class TestFindContactByPhone:
    """Proxy a GET /api/v1/contacts/find_by_phone (US-CONV-002 webhook auto-linking)."""

    async def test_method_exists_on_service_instance(self):
        """Regression: method must exist on the live singleton (try_link_conversation swallows AttributeError)."""
        from app.services.messaging_service import messaging_service

        assert hasattr(messaging_service, "find_contact_by_phone")
        assert callable(messaging_service.find_contact_by_phone)

    async def test_returns_rails_payload_on_success(self):
        service = MessagingService()
        rails_payload = {
            "success": True,
            "data": {
                "contact_id": 42,
                "phone_number": "+51987654321",
                "name": "Test User",
                "conversation": {"id": 7, "created_at": "2026-05-01T12:00:00Z"},
            },
        }
        with patch.object(
            service, "_request", new=AsyncMock(return_value=rails_payload)
        ) as mock_req:
            result = await service.find_contact_by_phone(
                tenant_id=10, phone="+51987654321"
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "GET",
            "/api/v1/contacts/find_by_phone",
            10,
            params={"phone": "+51987654321"},
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.find_contact_by_phone(
                tenant_id=10, phone="+51987654321"
            )

        assert result is None


@pytest.mark.asyncio
class TestUpdateContact:
    """Proxy a PATCH /api/v1/contacts/:id (Module 7 — contact edit)."""

    async def test_forwards_payload_wrapped_in_contact(self):
        service = MessagingService()
        rails_payload = {"success": True, "data": {"id": 42, "name": "Renzo"}}
        with patch.object(service, "_request", new=AsyncMock(return_value=rails_payload)) as mock_req:
            result = await service.update_contact(
                tenant_id=10, contact_id=42, payload={"name": "Renzo", "email": "r@v.com"}
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "PATCH",
            "/api/v1/contacts/42",
            10,
            json_data={"contact": {"name": "Renzo", "email": "r@v.com"}},
        )

    async def test_returns_none_on_request_failure(self):
        service = MessagingService()
        with patch.object(service, "_request", new=AsyncMock(return_value=None)):
            result = await service.update_contact(tenant_id=10, contact_id=42, payload={})
        assert result is None

    async def test_forwards_birthdate_iso_string(self):
        service = MessagingService()
        rails_payload = {
            "success": True,
            "data": {"id": 42, "birthdate": "1995-03-12"},
        }
        with patch.object(service, "_request", new=AsyncMock(return_value=rails_payload)) as mock_req:
            result = await service.update_contact(
                tenant_id=10, contact_id=42, payload={"birthdate": "1995-03-12"}
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "PATCH",
            "/api/v1/contacts/42",
            10,
            json_data={"contact": {"birthdate": "1995-03-12"}},
        )


@pytest.mark.asyncio
class TestContactNotes:
    """Proxy a /api/v1/contacts/:contact_id/notes (Module 7)."""

    async def test_get_notes_forwards_get(self):
        service = MessagingService()
        rails_payload = {"success": True, "data": [{"id": 1, "content": "Cliente VIP"}]}
        with patch.object(service, "_request", new=AsyncMock(return_value=rails_payload)) as mock_req:
            result = await service.get_contact_notes(tenant_id=10, contact_id=42)

        assert result == rails_payload
        mock_req.assert_awaited_once_with("GET", "/api/v1/contacts/42/notes", 10)

    async def test_create_note_wraps_content_in_note(self):
        service = MessagingService()
        rails_payload = {"success": True, "data": {"id": 5, "content": "Nueva"}}
        with patch.object(service, "_request", new=AsyncMock(return_value=rails_payload)) as mock_req:
            result = await service.create_contact_note(
                tenant_id=10, contact_id=42, content="Nueva"
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "POST",
            "/api/v1/contacts/42/notes",
            10,
            json_data={"note": {"content": "Nueva"}},
        )

    async def test_update_note_wraps_content_in_note(self):
        service = MessagingService()
        rails_payload = {"success": True, "data": {"id": 5, "content": "Editada"}}
        with patch.object(service, "_request", new=AsyncMock(return_value=rails_payload)) as mock_req:
            result = await service.update_contact_note(
                tenant_id=10, contact_id=42, note_id=5, content="Editada"
            )

        assert result == rails_payload
        mock_req.assert_awaited_once_with(
            "PATCH",
            "/api/v1/contacts/42/notes/5",
            10,
            json_data={"note": {"content": "Editada"}},
        )

    async def test_delete_note_uses_delete_method(self):
        service = MessagingService()
        rails_payload = {"success": True}
        with patch.object(service, "_request", new=AsyncMock(return_value=rails_payload)) as mock_req:
            result = await service.delete_contact_note(tenant_id=10, contact_id=42, note_id=5)

        assert result == rails_payload
        mock_req.assert_awaited_once_with("DELETE", "/api/v1/contacts/42/notes/5", 10)
