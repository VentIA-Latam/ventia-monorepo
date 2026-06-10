"""Unit tests for messaging_service campaign proxy methods.

Spec: docs/superpowers/specs/2026-06-04-campaigns-engine-design.md
"""

from io import BytesIO
from unittest.mock import AsyncMock, patch

import pytest

from app.services.messaging_service import MessagingService


@pytest.mark.asyncio
class TestCreateCampaign:
    async def test_forwards_under_campaign_key(self):
        svc = MessagingService()
        with patch.object(svc, "_request", new=AsyncMock(return_value={"success": True, "data": {"id": 1}})) as m:
            payload = {"title": "X", "inbox_id": 12}
            result = await svc.create_campaign(tenant_id=1, payload=payload)

        assert result["data"]["id"] == 1
        m.assert_awaited_once_with("POST", "/api/v1/campaigns", 1, json_data={"campaign": payload})


@pytest.mark.asyncio
class TestUpdateCampaign:
    async def test_uses_PATCH(self):
        svc = MessagingService()
        with patch.object(svc, "_request", new=AsyncMock(return_value={"success": True, "data": {}})) as m:
            await svc.update_campaign(tenant_id=1, campaign_id=42, payload={"title": "Y"})
        m.assert_awaited_once_with(
            "PATCH", "/api/v1/campaigns/42", 1, json_data={"campaign": {"title": "Y"}}
        )


@pytest.mark.asyncio
class TestSetLabelsAudience:
    async def test_forwards_label_ids(self):
        svc = MessagingService()
        with patch.object(svc, "_request", new=AsyncMock(return_value={"success": True, "data": {"recipients_count": 5}})) as m:
            await svc.set_campaign_labels_audience(tenant_id=1, campaign_id=42, label_ids=[10, 20])
        m.assert_awaited_once_with(
            "POST", "/api/v1/campaigns/42/audience/labels", 1, json_data={"label_ids": [10, 20]}
        )


@pytest.mark.asyncio
class TestTriggerCampaign:
    async def test_immediate_passes_empty_payload(self):
        svc = MessagingService()
        with patch.object(svc, "_request", new=AsyncMock(return_value={"success": True})) as m:
            await svc.trigger_campaign(tenant_id=1, campaign_id=42)
        m.assert_awaited_once_with("POST", "/api/v1/campaigns/42/trigger", 1, json_data={})

    async def test_scheduled_passes_scheduled_at(self):
        svc = MessagingService()
        with patch.object(svc, "_request", new=AsyncMock(return_value={"success": True})) as m:
            await svc.trigger_campaign(tenant_id=1, campaign_id=42, scheduled_at="2026-12-31T10:00:00Z")
        m.assert_awaited_once_with(
            "POST", "/api/v1/campaigns/42/trigger", 1, json_data={"scheduled_at": "2026-12-31T10:00:00Z"}
        )


@pytest.mark.asyncio
class TestListRecipients:
    async def test_passes_filters_as_query_params(self):
        svc = MessagingService()
        with patch.object(svc, "_request", new=AsyncMock(return_value={"success": True, "data": []})) as m:
            await svc.list_campaign_recipients(
                tenant_id=1, campaign_id=42, page=2, per_page=50, status="failed,omitted", search="Juan"
            )
        m.assert_awaited_once_with(
            "GET", "/api/v1/campaigns/42/recipients", 1,
            params={"page": 2, "per_page": 50, "status": "failed,omitted", "search": "Juan"},
        )


@pytest.mark.asyncio
class TestUploadCsv:
    """Multipart upload usa httpx.AsyncClient directamente (no _request).
    Verifico que mande X-Tenant-Id + X-API-Key + el file en 'file' field.
    """

    class _FakeUpload:
        filename = "x.csv"
        content_type = "text/csv"
        async def read(self):
            return b"phone,cliente\n+51999888777,Juan\n"

    async def test_sends_multipart_with_tenant_header(self):
        svc = MessagingService()
        svc.api_key = "test-key"
        svc.base_url = "http://msg.local"

        # Mock httpx.AsyncClient context manager
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.json = lambda: {"success": True, "data": {"recipients_count": 1}}

        with patch("app.services.messaging_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = False
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            file = self._FakeUpload()
            result = await svc.upload_campaign_csv(tenant_id=1, campaign_id=42, file=file)

        assert result["data"]["recipients_count"] == 1
        mock_client.post.assert_awaited_once()
        args, kwargs = mock_client.post.call_args
        assert args[0] == "http://msg.local/api/v1/campaigns/42/audience/csv"
        assert kwargs["headers"]["X-Tenant-Id"] == "1"
        assert kwargs["headers"]["X-API-Key"] == "test-key"
        assert "file" in kwargs["files"]
