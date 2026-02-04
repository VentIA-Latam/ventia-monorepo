"""
Tests for WooCommerce webhook functionality.
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.integrations.woocommerce_client import WooCommerceClient, WooCommerceError, WooCommerceNotFoundError


@pytest.fixture
def woocommerce_client():
    """Create WooCommerce client for testing."""
    return WooCommerceClient(
        store_url="https://test-store.com",
        consumer_key="ck_test_key",
        consumer_secret="cs_test_secret",
    )


@pytest.mark.asyncio
async def test_create_webhook_success(woocommerce_client):
    """Test successful webhook creation."""
    mock_response = {
        "id": 123,
        "name": "VentIA - order.created",
        "status": "active",
        "topic": "order.created",
        "delivery_url": "https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
        "secret": "webhook_secret_123",
        "date_created": "2026-01-27T00:00:00",
        "date_created_gmt": "2026-01-27T00:00:00",
        "date_modified": "2026-01-27T00:00:00",
        "date_modified_gmt": "2026-01-27T00:00:00",
    }

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.return_value = mock_response

        result = await woocommerce_client.create_webhook(
            topic="order.created",
            delivery_url="https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
            secret="webhook_secret_123",
        )

        assert result["id"] == 123
        assert result["topic"] == "order.created"
        assert result["delivery_url"] == "https://api.ventia.pe/api/v1/webhooks/woocommerce/1"
        assert result["secret"] == "webhook_secret_123"
        assert result["status"] == "active"

        # Verify the request was made with correct data
        mock_request.assert_called_once_with(
            "POST",
            "/webhooks",
            data={
                "name": "VentIA - order.created",
                "topic": "order.created",
                "delivery_url": "https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
                "secret": "webhook_secret_123",
                "status": "active",
            },
        )


@pytest.mark.asyncio
async def test_create_webhook_with_different_topics(woocommerce_client):
    """Test creating webhooks for different topics."""
    topics = ["order.created", "order.updated", "order.deleted"]

    for topic in topics:
        mock_response = {
            "id": 100 + topics.index(topic),
            "name": f"VentIA - {topic}",
            "status": "active",
            "topic": topic,
            "delivery_url": "https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
            "secret": "secret",
        }

        with patch.object(
            woocommerce_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response

            result = await woocommerce_client.create_webhook(
                topic=topic,
                delivery_url="https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
                secret="secret",
            )

            assert result["topic"] == topic
            assert result["name"] == f"VentIA - {topic}"


@pytest.mark.asyncio
async def test_get_webhook_success(woocommerce_client):
    """Test successful webhook retrieval."""
    webhook_id = 123
    mock_response = {
        "id": webhook_id,
        "name": "VentIA - order.created",
        "status": "active",
        "topic": "order.created",
        "delivery_url": "https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
    }

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.return_value = mock_response

        result = await woocommerce_client.get_webhook(webhook_id)

        assert result["id"] == webhook_id
        assert result["topic"] == "order.created"

        mock_request.assert_called_once_with("GET", f"/webhooks/{webhook_id}")


@pytest.mark.asyncio
async def test_get_webhook_not_found(woocommerce_client):
    """Test getting a non-existent webhook."""
    webhook_id = 999

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.side_effect = WooCommerceNotFoundError(
            f"Resource not found: /webhooks/{webhook_id}",
            status_code=404,
        )

        with pytest.raises(WooCommerceNotFoundError):
            await woocommerce_client.get_webhook(webhook_id)


@pytest.mark.asyncio
async def test_delete_webhook_success(woocommerce_client):
    """Test successful webhook deletion."""
    webhook_id = 123
    mock_response = {
        "id": webhook_id,
        "name": "VentIA - order.created",
        "status": "active",
        "topic": "order.created",
    }

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.return_value = mock_response

        result = await woocommerce_client.delete_webhook(webhook_id)

        assert result["id"] == webhook_id

        mock_request.assert_called_once_with(
            "DELETE",
            f"/webhooks/{webhook_id}",
            data={"force": True},
        )


@pytest.mark.asyncio
async def test_delete_webhook_not_found(woocommerce_client):
    """Test deleting a non-existent webhook."""
    webhook_id = 999

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.side_effect = WooCommerceNotFoundError(
            f"Resource not found: /webhooks/{webhook_id}",
            status_code=404,
        )

        with pytest.raises(WooCommerceNotFoundError):
            await woocommerce_client.delete_webhook(webhook_id)


@pytest.mark.asyncio
async def test_list_webhooks_success(woocommerce_client):
    """Test listing all webhooks."""
    mock_response = [
        {
            "id": 123,
            "name": "VentIA - order.created",
            "topic": "order.created",
            "status": "active",
        },
        {
            "id": 124,
            "name": "VentIA - order.updated",
            "topic": "order.updated",
            "status": "active",
        },
    ]

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.return_value = mock_response

        result = await woocommerce_client.list_webhooks()

        assert len(result) == 2
        assert result[0]["id"] == 123
        assert result[1]["id"] == 124

        mock_request.assert_called_once_with("GET", "/webhooks")


@pytest.mark.asyncio
async def test_list_webhooks_empty(woocommerce_client):
    """Test listing webhooks when none exist."""
    mock_response = []

    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.return_value = mock_response

        result = await woocommerce_client.list_webhooks()

        assert len(result) == 0


@pytest.mark.asyncio
async def test_create_webhook_with_error(woocommerce_client):
    """Test webhook creation with API error."""
    with patch.object(
        woocommerce_client, "_request", new_callable=AsyncMock
    ) as mock_request:
        mock_request.side_effect = WooCommerceError(
            "Invalid delivery URL",
            status_code=400,
        )

        with pytest.raises(WooCommerceError, match="Invalid delivery URL"):
            await woocommerce_client.create_webhook(
                topic="order.created",
                delivery_url="invalid-url",
                secret="secret",
            )


@pytest.mark.asyncio
async def test_create_webhook_lowercase_topics(woocommerce_client):
    """Test that webhook topics are in lowercase format."""
    topics_to_test = [
        "order.created",
        "order.updated",
        "order.deleted",
        "order.restored",
    ]

    for topic in topics_to_test:
        mock_response = {
            "id": 100,
            "topic": topic,
            "status": "active",
        }

        with patch.object(
            woocommerce_client, "_request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response

            result = await woocommerce_client.create_webhook(
                topic=topic,
                delivery_url="https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
                secret="secret",
            )

            # Verify topic is in lowercase
            assert result["topic"] == topic
            assert result["topic"] == result["topic"].lower()
