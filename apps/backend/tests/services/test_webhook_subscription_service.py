"""
Tests for webhook subscription service.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.webhook_subscription_service import (
    WebhookSubscriptionService,
    SHOPIFY_WEBHOOK_TOPICS,
    WOOCOMMERCE_WEBHOOK_TOPICS,
)


@pytest.fixture
def mock_db():
    """Create mock database session."""
    db = MagicMock()
    return db


@pytest.fixture
def webhook_service(mock_db):
    """Create webhook subscription service."""
    return WebhookSubscriptionService(db=mock_db)


@pytest.fixture
def mock_shopify_client():
    """Create mock Shopify client."""
    client = MagicMock()
    client.create_webhook_subscription = AsyncMock()
    client.delete_webhook_subscription = AsyncMock()
    return client


@pytest.fixture
def mock_woocommerce_client():
    """Create mock WooCommerce client."""
    client = MagicMock()
    client.create_webhook = AsyncMock()
    client.delete_webhook = AsyncMock()
    return client


class TestWebhookSubscriptionService:
    """Tests for WebhookSubscriptionService."""

    def test_get_webhook_base_url_from_settings(self, webhook_service):
        """Test getting webhook base URL from settings."""
        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            result = webhook_service._get_webhook_base_url()

            assert result == "https://api.ventia.pe"

    def test_get_webhook_base_url_fallback_to_cors(self, webhook_service):
        """Test fallback to CORS origins when WEBHOOK_BASE_URL not set."""
        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = ""
            mock_settings.CORS_ORIGINS = ["https://app.ventia.pe", "http://localhost:3000"]

            result = webhook_service._get_webhook_base_url()

            assert result == "https://app.ventia.pe"

    def test_get_webhook_base_url_no_config_raises_error(self, webhook_service):
        """Test that missing webhook base URL raises error."""
        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = ""
            mock_settings.CORS_ORIGINS = []

            with pytest.raises(ValueError, match="WEBHOOK_BASE_URL not configured"):
                webhook_service._get_webhook_base_url()

    def test_build_callback_url(self, webhook_service):
        """Test building callback URL for webhooks."""
        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            result = webhook_service._build_callback_url("shopify", 123)

            assert result == "https://api.ventia.pe/api/v1/webhooks/shopify/123"

    @pytest.mark.asyncio
    async def test_subscribe_shopify_webhooks_creates_all_subscriptions(
        self, webhook_service, mock_shopify_client, mock_db
    ):
        """Test subscribing to all Shopify webhooks."""
        # Mock repository to return None (no existing subscriptions)
        webhook_service.repository.get_by_tenant_platform_topic = MagicMock(return_value=None)

        # Mock Shopify client responses
        mock_shopify_client.create_webhook_subscription.return_value = {
            "id": "gid://shopify/WebhookSubscription/123",
            "topic": "DRAFT_ORDERS_CREATE",
            "callbackUrl": "https://api.ventia.pe/api/v1/webhooks/shopify/1",
        }

        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            result = await webhook_service.subscribe_shopify_webhooks(
                tenant_id=1,
                shopify_client=mock_shopify_client,
            )

        # Should create all 7 Shopify webhook topics
        assert result["created"] == 7
        assert result["skipped"] == 0
        assert result["failed"] == 0
        assert len(result["subscriptions"]) == 7
        assert mock_shopify_client.create_webhook_subscription.call_count == 7

    @pytest.mark.asyncio
    async def test_subscribe_shopify_webhooks_skips_existing(
        self, webhook_service, mock_shopify_client, mock_db
    ):
        """Test that existing subscriptions are skipped."""
        # Mock existing subscription
        existing_sub = MagicMock()
        existing_sub.subscription_id = "gid://shopify/WebhookSubscription/999"

        webhook_service.repository.get_by_tenant_platform_topic = MagicMock(return_value=existing_sub)

        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            result = await webhook_service.subscribe_shopify_webhooks(
                tenant_id=1,
                shopify_client=mock_shopify_client,
            )

        # All should be skipped
        assert result["created"] == 0
        assert result["skipped"] == 7
        assert result["failed"] == 0
        assert mock_shopify_client.create_webhook_subscription.call_count == 0

    @pytest.mark.asyncio
    async def test_subscribe_shopify_webhooks_continues_on_error(
        self, webhook_service, mock_shopify_client, mock_db
    ):
        """Test that subscription continues even if one fails."""
        webhook_service.repository.get_by_tenant_platform_topic = MagicMock(return_value=None)

        # First call fails, rest succeed
        call_count = 0

        async def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Shopify API error")
            return {
                "id": f"gid://shopify/WebhookSubscription/{call_count}",
                "topic": kwargs.get("topic", ""),
                "callbackUrl": kwargs.get("callback_url", ""),
            }

        mock_shopify_client.create_webhook_subscription.side_effect = side_effect

        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            result = await webhook_service.subscribe_shopify_webhooks(
                tenant_id=1,
                shopify_client=mock_shopify_client,
            )

        # 1 failed, 6 succeeded
        assert result["created"] == 6
        assert result["skipped"] == 0
        assert result["failed"] == 1

    @pytest.mark.asyncio
    async def test_subscribe_woocommerce_webhooks_creates_all_subscriptions(
        self, webhook_service, mock_woocommerce_client, mock_db
    ):
        """Test subscribing to all WooCommerce webhooks."""
        webhook_service.repository.get_by_tenant_platform_topic = MagicMock(return_value=None)

        # Mock WooCommerce client responses
        mock_woocommerce_client.create_webhook.return_value = {
            "id": 123,
            "name": "VentIA - order.created",
            "topic": "order.created",
            "delivery_url": "https://api.ventia.pe/api/v1/webhooks/woocommerce/1",
        }

        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            result = await webhook_service.subscribe_woocommerce_webhooks(
                tenant_id=1,
                woocommerce_client=mock_woocommerce_client,
                webhook_secret="test_secret",
            )

        # Should create all 3 WooCommerce webhook topics
        assert result["created"] == 3
        assert result["skipped"] == 0
        assert result["failed"] == 0
        assert len(result["subscriptions"]) == 3
        assert mock_woocommerce_client.create_webhook.call_count == 3

    @pytest.mark.asyncio
    async def test_subscribe_woocommerce_webhooks_passes_secret(
        self, webhook_service, mock_woocommerce_client, mock_db
    ):
        """Test that webhook secret is passed to WooCommerce."""
        webhook_service.repository.get_by_tenant_platform_topic = MagicMock(return_value=None)

        mock_woocommerce_client.create_webhook.return_value = {
            "id": 123,
            "topic": "order.created",
        }

        with patch("app.services.webhook_subscription_service.settings") as mock_settings:
            mock_settings.WEBHOOK_BASE_URL = "https://api.ventia.pe"

            await webhook_service.subscribe_woocommerce_webhooks(
                tenant_id=1,
                woocommerce_client=mock_woocommerce_client,
                webhook_secret="my_secret_key",
            )

        # Verify secret was passed
        calls = mock_woocommerce_client.create_webhook.call_args_list
        for call in calls:
            assert call[1]["secret"] == "my_secret_key"

    @pytest.mark.asyncio
    async def test_unsubscribe_shopify_webhooks_deletes_all(
        self, webhook_service, mock_shopify_client, mock_db
    ):
        """Test deleting all Shopify webhook subscriptions."""
        # Mock existing subscriptions
        mock_subs = [
            MagicMock(subscription_id="gid://shopify/WebhookSubscription/1", topic="DRAFT_ORDERS_CREATE"),
            MagicMock(subscription_id="gid://shopify/WebhookSubscription/2", topic="ORDERS_PAID"),
        ]

        webhook_service.repository.get_by_tenant_platform = MagicMock(return_value=mock_subs)
        mock_shopify_client.delete_webhook_subscription.return_value = True

        result = await webhook_service.unsubscribe_shopify_webhooks(
            tenant_id=1,
            shopify_client=mock_shopify_client,
        )

        assert result["deleted"] == 2
        assert result["failed"] == 0
        assert mock_shopify_client.delete_webhook_subscription.call_count == 2

    @pytest.mark.asyncio
    async def test_unsubscribe_woocommerce_webhooks_deletes_all(
        self, webhook_service, mock_woocommerce_client, mock_db
    ):
        """Test deleting all WooCommerce webhook subscriptions."""
        # Mock existing subscriptions
        mock_subs = [
            MagicMock(subscription_id="123", topic="order.created"),
            MagicMock(subscription_id="124", topic="order.updated"),
        ]

        webhook_service.repository.get_by_tenant_platform = MagicMock(return_value=mock_subs)
        mock_woocommerce_client.delete_webhook.return_value = {"id": 123}

        result = await webhook_service.unsubscribe_woocommerce_webhooks(
            tenant_id=1,
            woocommerce_client=mock_woocommerce_client,
        )

        assert result["deleted"] == 2
        assert result["failed"] == 0
        assert mock_woocommerce_client.delete_webhook.call_count == 2

    @pytest.mark.asyncio
    async def test_unsubscribe_shopify_handles_errors(
        self, webhook_service, mock_shopify_client, mock_db
    ):
        """Test that unsubscribe continues even if deletion fails."""
        mock_subs = [
            MagicMock(subscription_id="gid://shopify/WebhookSubscription/1", topic="DRAFT_ORDERS_CREATE"),
            MagicMock(subscription_id="gid://shopify/WebhookSubscription/2", topic="ORDERS_PAID"),
        ]

        webhook_service.repository.get_by_tenant_platform = MagicMock(return_value=mock_subs)

        # First delete fails, second succeeds
        mock_shopify_client.delete_webhook_subscription.side_effect = [
            Exception("Shopify error"),
            True,
        ]

        result = await webhook_service.unsubscribe_shopify_webhooks(
            tenant_id=1,
            shopify_client=mock_shopify_client,
        )

        assert result["deleted"] == 1
        assert result["failed"] == 1


class TestWebhookTopicConstants:
    """Tests for webhook topic constants."""

    def test_shopify_topics_are_uppercase(self):
        """Test that all Shopify topics are UPPERCASE."""
        for topic in SHOPIFY_WEBHOOK_TOPICS:
            assert topic == topic.upper(), f"Shopify topic {topic} should be UPPERCASE"

    def test_shopify_has_seven_topics(self):
        """Test that Shopify has 7 topics defined."""
        assert len(SHOPIFY_WEBHOOK_TOPICS) == 7

    def test_woocommerce_topics_are_lowercase(self):
        """Test that all WooCommerce topics are lowercase."""
        for topic in WOOCOMMERCE_WEBHOOK_TOPICS:
            assert topic == topic.lower(), f"WooCommerce topic {topic} should be lowercase"

    def test_woocommerce_has_three_topics(self):
        """Test that WooCommerce has 3 topics defined."""
        assert len(WOOCOMMERCE_WEBHOOK_TOPICS) == 3
