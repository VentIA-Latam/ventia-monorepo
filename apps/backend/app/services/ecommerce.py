"""
Unified e-commerce service for order validation across platforms.

This service abstracts the e-commerce platform (Shopify, WooCommerce) and provides
a unified interface for validating orders and syncing payment status.
"""

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.integrations.shopify_client import ShopifyClient
from app.integrations.woocommerce_client import (
    WooCommerceAuthError,
    WooCommerceClient,
    WooCommerceError,
    WooCommerceNotFoundError,
)
from app.models.order import Order
from app.repositories.order import order_repository
from app.schemas.order import OrderCancel
from app.schemas.tenant_settings import ShopifyCredentials, WooCommerceCredentials

logger = logging.getLogger(__name__)


class EcommerceService:
    """
    Unified service for e-commerce order validation.

    Handles payment validation and syncing across multiple platforms:
    - Shopify: Completes draft orders via GraphQL API
    - WooCommerce: Marks orders as paid via REST API

    The service reads platform configuration from tenant.get_settings() and
    automatically routes to the appropriate platform client.
    """

    async def validate_order(
        self,
        db: Session,
        order: Order,
        payment_method: str | None = None,
        notes: str | None = None,
    ) -> Order:
        """
        Validate payment for an order and sync to e-commerce platform if configured.

        This is the main entry point for order validation. It:
        1. Checks if order is already validated
        2. Gets tenant e-commerce settings
        3. Syncs to platform if configured and enabled
        4. Updates order status locally

        Args:
            db: Database session
            order: Order to validate (must have tenant relationship loaded)
            payment_method: Optional payment method used
            notes: Optional validation notes

        Returns:
            Updated order with validado=True, validated_at set, status="Pagado"

        Raises:
            ValueError: If order already validated or configuration mismatch
            WooCommerceAuthError: If WooCommerce credentials are invalid
            WooCommerceNotFoundError: If WooCommerce order not found
        """
        # 1. Check if already validated
        if order.validado:
            raise ValueError(f"Order {order.id} has already been validated at {order.validated_at}")

        # 2. Get tenant and settings
        tenant = order.tenant
        if not tenant:
            raise ValueError(f"Tenant not found for order {order.id}")

        settings = tenant.get_settings()
        platform = settings.platform
        sync_enabled = settings.ecommerce.sync_on_validation if settings.ecommerce else False

        logger.info(
            f"Validating order {order.id}: platform={platform}, "
            f"sync_enabled={sync_enabled}, order_platform={order.source_platform}"
        )

        # 3. Sync to e-commerce platform if configured
        shopify_order_id = None

        if settings.has_ecommerce and sync_enabled:
            # Verify platform matches order source
            if platform == "shopify" and order.source_platform != "shopify":
                raise ValueError(
                    f"Tenant is configured for Shopify but order {order.id} "
                    f"has no shopify_draft_order_id"
                )
            if platform == "woocommerce" and order.source_platform != "woocommerce":
                raise ValueError(
                    f"Tenant is configured for WooCommerce but order {order.id} "
                    f"has no woocommerce_order_id"
                )

            # Sync based on platform
            if platform == "shopify":
                shopify_order_id = await self._sync_shopify(db, order, settings.ecommerce.shopify)
            elif platform == "woocommerce":
                await self._sync_woocommerce(order, settings.ecommerce.woocommerce)

        # 4. Update order locally via repository
        update_data: dict = {
            "validado": True,
            "validated_at": datetime.utcnow(),
            "status": "Pagado",
        }

        if shopify_order_id:
            update_data["shopify_order_id"] = shopify_order_id

        if payment_method:
            update_data["payment_method"] = payment_method
        if notes:
            update_data["notes"] = notes

        updated_order = order_repository.update(db, db_obj=order, obj_in=update_data)

        logger.info(f"Order {order.id} validated successfully")
        return updated_order

    async def _sync_shopify(
        self,
        db: Session,
        order: Order,
        credentials: ShopifyCredentials,
    ) -> str | None:
        """
        Sync order validation to Shopify by completing the draft order.

        Automatically obtains a valid access token using ShopifyTokenManager,
        which handles token refresh if needed.

        Args:
            db: Database session
            order: Order with shopify_draft_order_id
            credentials: Shopify API credentials (used for store_url and api_version)

        Returns:
            Shopify order ID if successful

        Raises:
            ValueError: If Shopify API call fails or token cannot be obtained
        """
        from app.integrations.shopify_token_manager import shopify_token_manager

        # Get a valid access token (auto-refreshes if needed)
        try:
            access_token = await shopify_token_manager.get_valid_access_token(
                db=db,
                tenant=order.tenant,
            )
        except ValueError as e:
            raise ValueError(f"Failed to get Shopify access token: {str(e)}") from e

        client = ShopifyClient(
            store_url=credentials.store_url,
            access_token=access_token,
            api_version=credentials.api_version,
        )

        logger.info(f"Completing Shopify draft order: {order.shopify_draft_order_id}")

        try:
            result = await client.complete_draft_order(order.shopify_draft_order_id)
            shopify_order_id = result.get("order_id")
            logger.info(f"Shopify draft order completed: {shopify_order_id}")
            return shopify_order_id

        except Exception as e:
            logger.error(f"Failed to complete Shopify draft order: {e}")
            raise ValueError(f"Failed to complete draft order in Shopify: {str(e)}") from e

    async def _sync_woocommerce(
        self,
        order: Order,
        credentials: WooCommerceCredentials,
    ) -> None:
        """
        Sync order validation to WooCommerce by marking the order as paid.

        Args:
            order: Order with woocommerce_order_id
            credentials: WooCommerce API credentials

        Raises:
            WooCommerceAuthError: If credentials are invalid (401)
            WooCommerceNotFoundError: If order not found in WooCommerce (404)
            WooCommerceError: For other API errors
        """
        if not credentials.consumer_key or not credentials.consumer_secret:
            raise ValueError("WooCommerce credentials not configured")

        client = WooCommerceClient(
            store_url=credentials.store_url,
            consumer_key=credentials.consumer_key,
            consumer_secret=credentials.consumer_secret,
        )

        logger.info(f"Marking WooCommerce order as paid: {order.woocommerce_order_id}")

        try:
            result = await client.mark_order_as_paid(order.woocommerce_order_id)
            logger.info(
                f"WooCommerce order marked as paid: "
                f"status={result.get('status')}, date_paid={result.get('date_paid')}"
            )

        except WooCommerceAuthError:
            logger.error(f"WooCommerce auth failed for order {order.woocommerce_order_id}")
            raise

        except WooCommerceNotFoundError:
            logger.error(f"WooCommerce order not found: {order.woocommerce_order_id}")
            raise

        except WooCommerceError as e:
            logger.error(f"WooCommerce API error: {e}")
            raise


    async def cancel_order(
        self,
        db: Session,
        order: Order,
        cancel_data: OrderCancel,
    ) -> Order:
        """
        Cancel an order and sync cancellation to e-commerce platform.

        Routes to the appropriate platform method based on order state:
        - Shopify draft (not validated): permanently deletes the draft
        - Shopify completed (validated): cancels with reason, refund, restock options
        - WooCommerce: sets order status to cancelled

        Args:
            db: Database session
            order: Order to cancel (must have tenant relationship loaded)
            cancel_data: Cancellation options (reason, restock, refund method, etc.)

        Returns:
            Updated order with status="Cancelado"

        Raises:
            ValueError: If order already cancelled or platform sync fails
            WooCommerceAuthError: If WooCommerce credentials are invalid
            WooCommerceNotFoundError: If WooCommerce order not found
        """
        if order.status == "Cancelado":
            raise ValueError(f"Order {order.id} is already cancelled")

        tenant = order.tenant
        if not tenant:
            raise ValueError(f"Tenant not found for order {order.id}")

        settings = tenant.get_settings()
        platform = settings.platform
        sync_enabled = settings.ecommerce.sync_on_validation if settings.ecommerce else False

        logger.info(
            f"Cancelling order {order.id}: platform={platform}, "
            f"sync_enabled={sync_enabled}, order_platform={order.source_platform}"
        )

        # Sync to e-commerce platform if configured
        if settings.has_ecommerce and sync_enabled:
            if platform == "shopify":
                if not order.validado:
                    await self._cancel_shopify_draft(db, order, settings.ecommerce.shopify)
                else:
                    await self._cancel_shopify_order(db, order, settings.ecommerce.shopify, cancel_data)
            elif platform == "woocommerce":
                await self._cancel_woocommerce(order, settings.ecommerce.woocommerce)

        # Update local order status
        update_data: dict = {"status": "Cancelado"}

        if cancel_data.staff_note:
            existing_notes = order.notes or ""
            update_data["notes"] = f"{existing_notes}\n[Cancelación] {cancel_data.staff_note}".strip()

        updated_order = order_repository.update(db, db_obj=order, obj_in=update_data)

        logger.info(f"Order {order.id} cancelled successfully")
        return updated_order

    async def _cancel_shopify_draft(
        self,
        db: Session,
        order: Order,
        credentials: ShopifyCredentials,
    ) -> None:
        """
        Delete a Shopify draft order (permanent removal from Shopify).

        Args:
            db: Database session
            order: Order with shopify_draft_order_id
            credentials: Shopify API credentials

        Raises:
            ValueError: If token cannot be obtained or API call fails
        """
        from app.integrations.shopify_token_manager import shopify_token_manager

        try:
            access_token = await shopify_token_manager.get_valid_access_token(
                db=db,
                tenant=order.tenant,
            )
        except ValueError as e:
            raise ValueError(f"Failed to get Shopify access token: {str(e)}") from e

        client = ShopifyClient(
            store_url=credentials.store_url,
            access_token=access_token,
            api_version=credentials.api_version,
        )

        logger.info(f"Deleting Shopify draft order: {order.shopify_draft_order_id}")

        try:
            await client.delete_draft_order(order.shopify_draft_order_id)
            logger.info(f"Shopify draft order deleted: {order.shopify_draft_order_id}")

        except Exception as e:
            logger.error(f"Failed to delete Shopify draft order: {e}")
            raise ValueError(f"Failed to delete draft order in Shopify: {str(e)}") from e

    async def _cancel_shopify_order(
        self,
        db: Session,
        order: Order,
        credentials: ShopifyCredentials,
        cancel_data: OrderCancel,
    ) -> None:
        """
        Cancel a completed Shopify order with reason, refund and restock options.

        Args:
            db: Database session
            order: Order with shopify_order_id
            credentials: Shopify API credentials
            cancel_data: Cancellation options

        Raises:
            ValueError: If token cannot be obtained or API call fails
        """
        from app.integrations.shopify_token_manager import shopify_token_manager

        try:
            access_token = await shopify_token_manager.get_valid_access_token(
                db=db,
                tenant=order.tenant,
            )
        except ValueError as e:
            raise ValueError(f"Failed to get Shopify access token: {str(e)}") from e

        client = ShopifyClient(
            store_url=credentials.store_url,
            access_token=access_token,
            api_version=credentials.api_version,
        )

        logger.info(f"Cancelling Shopify order: {order.shopify_order_id}")

        try:
            await client.cancel_order(
                order_id=order.shopify_order_id,
                reason=cancel_data.reason,
                restock=cancel_data.restock,
                notify_customer=cancel_data.notify_customer,
                refund_method=cancel_data.refund_method,
                staff_note=cancel_data.staff_note,
            )
            logger.info(f"Shopify order cancelled: {order.shopify_order_id}")

        except Exception as e:
            logger.error(f"Failed to cancel Shopify order: {e}")
            raise ValueError(f"Failed to cancel order in Shopify: {str(e)}") from e

    async def _cancel_woocommerce(
        self,
        order: Order,
        credentials: WooCommerceCredentials,
    ) -> None:
        """
        Cancel a WooCommerce order by setting its status to cancelled.

        Args:
            order: Order with woocommerce_order_id
            credentials: WooCommerce API credentials

        Raises:
            WooCommerceAuthError: If credentials are invalid (401)
            WooCommerceNotFoundError: If order not found in WooCommerce (404)
            WooCommerceError: For other API errors
        """
        if not credentials.consumer_key or not credentials.consumer_secret:
            raise ValueError("WooCommerce credentials not configured")

        client = WooCommerceClient(
            store_url=credentials.store_url,
            consumer_key=credentials.consumer_key,
            consumer_secret=credentials.consumer_secret,
        )

        logger.info(f"Cancelling WooCommerce order: {order.woocommerce_order_id}")

        try:
            result = await client.update_order_status(order.woocommerce_order_id, "cancelled")
            logger.info(
                f"WooCommerce order cancelled: "
                f"status={result.get('status')}"
            )

        except WooCommerceAuthError:
            logger.error(f"WooCommerce auth failed for order {order.woocommerce_order_id}")
            raise

        except WooCommerceNotFoundError:
            logger.error(f"WooCommerce order not found: {order.woocommerce_order_id}")
            raise

        except WooCommerceError as e:
            logger.error(f"WooCommerce API error: {e}")
            raise


# Global service instance
ecommerce_service = EcommerceService()
