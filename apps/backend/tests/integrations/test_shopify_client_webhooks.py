"""
Tests for Shopify webhook subscription functionality.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.integrations.shopify_client import ShopifyClient


@pytest.fixture
def shopify_client():
    """Create Shopify client for testing."""
    return ShopifyClient(
        store_url="https://test-store.myshopify.com",
        access_token="test_token",
        api_version="2025-01",
    )


@pytest.mark.asyncio
async def test_create_webhook_subscription_success(shopify_client):
    """Test successful webhook subscription creation."""
    mock_response = {
        "data": {
            "webhookSubscriptionCreate": {
                "webhookSubscription": {
                    "id": "gid://shopify/WebhookSubscription/123456789",
                    "topic": "DRAFT_ORDERS_CREATE",
                    "callbackUrl": "https://api.ventia.pe/api/v1/webhooks/shopify/1",
                    "createdAt": "2026-01-27T00:00:00Z",
                },
                "userErrors": [],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        result = await shopify_client.create_webhook_subscription(
            topic="DRAFT_ORDERS_CREATE",
            callback_url="https://api.ventia.pe/api/v1/webhooks/shopify/1",
        )

        assert result["id"] == "gid://shopify/WebhookSubscription/123456789"
        assert result["topic"] == "DRAFT_ORDERS_CREATE"
        assert result["callbackUrl"] == "https://api.ventia.pe/api/v1/webhooks/shopify/1"


@pytest.mark.asyncio
async def test_create_webhook_subscription_with_user_errors(shopify_client):
    """Test webhook subscription creation with user errors."""
    mock_response = {
        "data": {
            "webhookSubscriptionCreate": {
                "webhookSubscription": None,
                "userErrors": [
                    {
                        "field": "callbackUrl",
                        "message": "Invalid URL format",
                    }
                ],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        with pytest.raises(ValueError, match="Invalid URL format"):
            await shopify_client.create_webhook_subscription(
                topic="DRAFT_ORDERS_CREATE",
                callback_url="invalid-url",
            )


@pytest.mark.asyncio
async def test_delete_webhook_subscription_success(shopify_client):
    """Test successful webhook subscription deletion."""
    subscription_id = "gid://shopify/WebhookSubscription/123456789"
    mock_response = {
        "data": {
            "webhookSubscriptionDelete": {
                "deletedWebhookSubscriptionId": subscription_id,
                "userErrors": [],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        result = await shopify_client.delete_webhook_subscription(subscription_id)

        assert result is True


@pytest.mark.asyncio
async def test_delete_webhook_subscription_with_errors(shopify_client):
    """Test webhook subscription deletion with errors."""
    subscription_id = "gid://shopify/WebhookSubscription/123456789"
    mock_response = {
        "data": {
            "webhookSubscriptionDelete": {
                "deletedWebhookSubscriptionId": None,
                "userErrors": [
                    {
                        "field": "id",
                        "message": "Subscription not found",
                    }
                ],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        with pytest.raises(ValueError, match="Subscription not found"):
            await shopify_client.delete_webhook_subscription(subscription_id)


@pytest.mark.asyncio
async def test_create_webhook_subscription_no_data_returned(shopify_client):
    """Test webhook subscription creation when no subscription data is returned."""
    mock_response = {
        "data": {
            "webhookSubscriptionCreate": {
                "webhookSubscription": None,
                "userErrors": [],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        with pytest.raises(ValueError, match="Webhook subscription created but no data returned"):
            await shopify_client.create_webhook_subscription(
                topic="ORDERS_PAID",
                callback_url="https://api.ventia.pe/api/v1/webhooks/shopify/1",
            )


@pytest.mark.asyncio
async def test_create_webhook_subscription_with_multiple_topics(shopify_client):
    """Test creating webhook subscriptions for different topics."""
    topics = [
        "DRAFT_ORDERS_CREATE",
        "DRAFT_ORDERS_UPDATE",
        "ORDERS_CREATE",
        "ORDERS_PAID",
        "ORDERS_UPDATED",
        "ORDERS_CANCELLED",
    ]

    for topic in topics:
        mock_response = {
            "data": {
                "webhookSubscriptionCreate": {
                    "webhookSubscription": {
                        "id": f"gid://shopify/WebhookSubscription/{topic}",
                        "topic": topic,
                        "callbackUrl": "https://api.ventia.pe/api/v1/webhooks/shopify/1",
                        "createdAt": "2026-01-27T00:00:00Z",
                    },
                    "userErrors": [],
                }
            }
        }

        with patch.object(
            shopify_client, "_execute_query", new_callable=AsyncMock
        ) as mock_query:
            mock_query.return_value = mock_response

            result = await shopify_client.create_webhook_subscription(
                topic=topic,
                callback_url="https://api.ventia.pe/api/v1/webhooks/shopify/1",
            )

            assert result["topic"] == topic
            assert "WebhookSubscription" in result["id"]


@pytest.mark.asyncio
async def test_create_webhook_subscription_verifies_format_json(shopify_client):
    """Test that webhook subscription is created with JSON format."""
    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = {
            "data": {
                "webhookSubscriptionCreate": {
                    "webhookSubscription": {
                        "id": "gid://shopify/WebhookSubscription/123",
                        "topic": "ORDERS_PAID",
                        "callbackUrl": "https://api.ventia.pe/api/v1/webhooks/shopify/1",
                        "createdAt": "2026-01-27T00:00:00Z",
                    },
                    "userErrors": [],
                }
            }
        }

        await shopify_client.create_webhook_subscription(
            topic="ORDERS_PAID",
            callback_url="https://api.ventia.pe/api/v1/webhooks/shopify/1",
        )

        # Verify the mutation was called with correct variables
        mock_query.assert_called_once()
        call_args = mock_query.call_args
        variables = call_args[0][1] if len(call_args[0]) > 1 else call_args[1]["variables"]

        assert variables["topic"] == "ORDERS_PAID"
        assert variables["webhookSubscription"]["format"] == "JSON"
        assert variables["webhookSubscription"]["callbackUrl"] == "https://api.ventia.pe/api/v1/webhooks/shopify/1"


@pytest.mark.asyncio
async def test_delete_webhook_subscription_returns_false_on_mismatch(shopify_client):
    """Test that delete returns False when deleted ID doesn't match requested ID."""
    subscription_id = "gid://shopify/WebhookSubscription/123"
    different_id = "gid://shopify/WebhookSubscription/999"

    mock_response = {
        "data": {
            "webhookSubscriptionDelete": {
                "deletedWebhookSubscriptionId": different_id,
                "userErrors": [],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        result = await shopify_client.delete_webhook_subscription(subscription_id)

        assert result is False


@pytest.mark.asyncio
async def test_create_webhook_subscription_with_multiple_user_errors(shopify_client):
    """Test webhook subscription creation with multiple user errors."""
    mock_response = {
        "data": {
            "webhookSubscriptionCreate": {
                "webhookSubscription": None,
                "userErrors": [
                    {
                        "field": "callbackUrl",
                        "message": "Invalid URL",
                    },
                    {
                        "field": "topic",
                        "message": "Invalid topic",
                    },
                ],
            }
        }
    }

    with patch.object(
        shopify_client, "_execute_query", new_callable=AsyncMock
    ) as mock_query:
        mock_query.return_value = mock_response

        with pytest.raises(ValueError) as exc_info:
            await shopify_client.create_webhook_subscription(
                topic="INVALID_TOPIC",
                callback_url="bad-url",
            )

        error_message = str(exc_info.value)
        assert "Invalid URL" in error_message
        assert "Invalid topic" in error_message
