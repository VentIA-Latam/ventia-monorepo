"""
Webhook subscription management service.

Handles automatic creation and deletion of webhook subscriptions
in Shopify and WooCommerce when tenants configure credentials.
"""

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.integrations.shopify_client import ShopifyClient
from app.integrations.woocommerce_client import WooCommerceClient
from app.models.webhook_subscription import WebhookSubscription
from app.repositories.webhook_subscription import webhook_subscription_repository

logger = logging.getLogger(__name__)

# Shopify webhook topics (UPPERCASE format)
SHOPIFY_WEBHOOK_TOPICS = [
    "DRAFT_ORDERS_CREATE",
    "DRAFT_ORDERS_UPDATE",
    "DRAFT_ORDERS_DELETE",
    "ORDERS_CREATE",
    "ORDERS_UPDATED",
    "ORDERS_PAID",
    "ORDERS_CANCELLED",
]

# WooCommerce webhook topics (lowercase format)
WOOCOMMERCE_WEBHOOK_TOPICS = [
    "order.created",
    "order.updated",
    "order.deleted",
]


class WebhookSubscriptionService:
    """
    Service for managing webhook subscriptions across platforms.

    Provides methods to create and delete webhook subscriptions
    for Shopify and WooCommerce, with idempotency and error handling.
    """

    def __init__(self, db: Session):
        """
        Initialize webhook subscription service.

        Args:
            db: Database session
        """
        self.db = db
        self.repository = webhook_subscription_repository

    def _get_webhook_base_url(self) -> str:
        """
        Get the base URL for webhook callbacks.

        Returns WEBHOOK_BASE_URL if set, otherwise falls back to first CORS origin.

        Returns:
            str: Base URL for webhooks (e.g., "https://api.ventia.pe")
        """
        if settings.WEBHOOK_BASE_URL:
            return settings.WEBHOOK_BASE_URL.rstrip("/")

        # Fallback to first CORS origin
        if settings.CORS_ORIGINS:
            return settings.CORS_ORIGINS[0].rstrip("/")

        raise ValueError("WEBHOOK_BASE_URL not configured and no CORS origins available")

    def _build_callback_url(self, platform: str, tenant_id: int) -> str:
        """
        Build webhook callback URL for a platform and tenant.

        Args:
            platform: Platform name ("shopify" or "woocommerce")
            tenant_id: Tenant ID

        Returns:
            str: Full callback URL
            Example: "https://api.ventia.pe/api/v1/webhooks/shopify/123"
        """
        base_url = self._get_webhook_base_url()
        return f"{base_url}/api/v1/webhooks/{platform}/{tenant_id}"

    async def subscribe_shopify_webhooks(
        self,
        tenant_id: int,
        shopify_client: ShopifyClient,
    ) -> dict[str, Any]:
        """
        Create all Shopify webhook subscriptions for a tenant.

        Subscribes to all topics defined in SHOPIFY_WEBHOOK_TOPICS.
        Skips topics that already have active subscriptions (idempotent).

        Args:
            tenant_id: Tenant ID
            shopify_client: Configured Shopify client for this tenant

        Returns:
            dict: Summary of subscription results
            {
                "created": 5,
                "skipped": 2,
                "failed": 0,
                "subscriptions": [...]
            }
        """
        callback_url = self._build_callback_url("shopify", tenant_id)

        results = {
            "created": 0,
            "skipped": 0,
            "failed": 0,
            "subscriptions": [],
        }

        for topic in SHOPIFY_WEBHOOK_TOPICS:
            try:
                # Check if subscription already exists
                existing = self.repository.get_by_tenant_platform_topic(
                    self.db, tenant_id, "shopify", topic
                )

                if existing:
                    logger.info(
                        f"Shopify webhook subscription already exists: "
                        f"tenant_id={tenant_id}, topic={topic}"
                    )
                    results["skipped"] += 1
                    results["subscriptions"].append(
                        {"topic": topic, "status": "skipped", "subscription_id": existing.subscription_id}
                    )
                    continue

                # Create subscription in Shopify
                subscription_data = await shopify_client.create_webhook_subscription(
                    topic=topic,
                    callback_url=callback_url,
                )

                # Save to database
                webhook_sub = WebhookSubscription(
                    platform="shopify",
                    tenant_id=tenant_id,
                    topic=topic,
                    subscription_id=subscription_data["id"],
                    callback_url=callback_url,
                )
                self.db.add(webhook_sub)
                self.db.commit()
                self.db.refresh(webhook_sub)

                logger.info(
                    f"Created Shopify webhook subscription: "
                    f"tenant_id={tenant_id}, topic={topic}, id={subscription_data['id']}"
                )

                results["created"] += 1
                results["subscriptions"].append(
                    {"topic": topic, "status": "created", "subscription_id": subscription_data["id"]}
                )

            except Exception as e:
                logger.error(
                    f"Failed to create Shopify webhook for topic {topic}: {str(e)}",
                    exc_info=True,
                )
                results["failed"] += 1
                results["subscriptions"].append(
                    {"topic": topic, "status": "failed", "error": str(e)}
                )
                # Continue with other subscriptions even if one fails

        return results

    async def subscribe_woocommerce_webhooks(
        self,
        tenant_id: int,
        woocommerce_client: WooCommerceClient,
        webhook_secret: str,
    ) -> dict[str, Any]:
        """
        Create all WooCommerce webhook subscriptions for a tenant.

        Subscribes to all topics defined in WOOCOMMERCE_WEBHOOK_TOPICS.
        Skips topics that already have active subscriptions (idempotent).

        Args:
            tenant_id: Tenant ID
            woocommerce_client: Configured WooCommerce client for this tenant
            webhook_secret: Secret for HMAC signature validation

        Returns:
            dict: Summary of subscription results
            {
                "created": 2,
                "skipped": 1,
                "failed": 0,
                "subscriptions": [...]
            }
        """
        callback_url = self._build_callback_url("woocommerce", tenant_id)

        results = {
            "created": 0,
            "skipped": 0,
            "failed": 0,
            "subscriptions": [],
        }

        for topic in WOOCOMMERCE_WEBHOOK_TOPICS:
            try:
                # Check if subscription already exists
                existing = self.repository.get_by_tenant_platform_topic(
                    self.db, tenant_id, "woocommerce", topic
                )

                if existing:
                    logger.info(
                        f"WooCommerce webhook subscription already exists: "
                        f"tenant_id={tenant_id}, topic={topic}"
                    )
                    results["skipped"] += 1
                    results["subscriptions"].append(
                        {"topic": topic, "status": "skipped", "subscription_id": existing.subscription_id}
                    )
                    continue

                # Create subscription in WooCommerce
                webhook_data = await woocommerce_client.create_webhook(
                    topic=topic,
                    delivery_url=callback_url,
                    secret=webhook_secret,
                )

                # Save to database (WooCommerce returns numeric ID)
                webhook_sub = WebhookSubscription(
                    platform="woocommerce",
                    tenant_id=tenant_id,
                    topic=topic,
                    subscription_id=str(webhook_data["id"]),  # Convert to string for consistency
                    callback_url=callback_url,
                )
                self.db.add(webhook_sub)
                self.db.commit()
                self.db.refresh(webhook_sub)

                logger.info(
                    f"Created WooCommerce webhook subscription: "
                    f"tenant_id={tenant_id}, topic={topic}, id={webhook_data['id']}"
                )

                results["created"] += 1
                results["subscriptions"].append(
                    {"topic": topic, "status": "created", "subscription_id": str(webhook_data["id"])}
                )

            except Exception as e:
                logger.error(
                    f"Failed to create WooCommerce webhook for topic {topic}: {str(e)}",
                    exc_info=True,
                )
                results["failed"] += 1
                results["subscriptions"].append(
                    {"topic": topic, "status": "failed", "error": str(e)}
                )
                # Continue with other subscriptions even if one fails

        return results

    async def unsubscribe_shopify_webhooks(
        self,
        tenant_id: int,
        shopify_client: ShopifyClient,
    ) -> dict[str, Any]:
        """
        Delete all Shopify webhook subscriptions for a tenant.

        Args:
            tenant_id: Tenant ID
            shopify_client: Configured Shopify client for this tenant

        Returns:
            dict: Summary of deletion results
            {
                "deleted": 5,
                "failed": 0,
                "subscriptions": [...]
            }
        """
        subscriptions = self.repository.get_by_tenant_platform(
            self.db, tenant_id, "shopify"
        )

        results = {
            "deleted": 0,
            "failed": 0,
            "subscriptions": [],
        }

        for subscription in subscriptions:
            try:
                # Delete from Shopify
                await shopify_client.delete_webhook_subscription(subscription.subscription_id)

                # Delete from database
                self.db.delete(subscription)
                self.db.commit()

                logger.info(
                    f"Deleted Shopify webhook subscription: "
                    f"tenant_id={tenant_id}, topic={subscription.topic}, id={subscription.subscription_id}"
                )

                results["deleted"] += 1
                results["subscriptions"].append(
                    {"topic": subscription.topic, "status": "deleted", "subscription_id": subscription.subscription_id}
                )

            except Exception as e:
                logger.error(
                    f"Failed to delete Shopify webhook {subscription.subscription_id}: {str(e)}",
                    exc_info=True,
                )
                results["failed"] += 1
                results["subscriptions"].append(
                    {"topic": subscription.topic, "status": "failed", "error": str(e)}
                )

        return results

    async def unsubscribe_woocommerce_webhooks(
        self,
        tenant_id: int,
        woocommerce_client: WooCommerceClient,
    ) -> dict[str, Any]:
        """
        Delete all WooCommerce webhook subscriptions for a tenant.

        Args:
            tenant_id: Tenant ID
            woocommerce_client: Configured WooCommerce client for this tenant

        Returns:
            dict: Summary of deletion results
            {
                "deleted": 3,
                "failed": 0,
                "subscriptions": [...]
            }
        """
        subscriptions = self.repository.get_by_tenant_platform(
            self.db, tenant_id, "woocommerce"
        )

        results = {
            "deleted": 0,
            "failed": 0,
            "subscriptions": [],
        }

        for subscription in subscriptions:
            try:
                # Delete from WooCommerce (convert subscription_id to int)
                await woocommerce_client.delete_webhook(int(subscription.subscription_id))

                # Delete from database
                self.db.delete(subscription)
                self.db.commit()

                logger.info(
                    f"Deleted WooCommerce webhook subscription: "
                    f"tenant_id={tenant_id}, topic={subscription.topic}, id={subscription.subscription_id}"
                )

                results["deleted"] += 1
                results["subscriptions"].append(
                    {"topic": subscription.topic, "status": "deleted", "subscription_id": subscription.subscription_id}
                )

            except Exception as e:
                logger.error(
                    f"Failed to delete WooCommerce webhook {subscription.subscription_id}: {str(e)}",
                    exc_info=True,
                )
                results["failed"] += 1
                results["subscriptions"].append(
                    {"topic": subscription.topic, "status": "failed", "error": str(e)}
                )

        return results
