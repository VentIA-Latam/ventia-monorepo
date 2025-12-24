"""
Shopify service - orchestrates order validation and Shopify API calls.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.integrations.shopify_client import ShopifyClient
from app.models.order import Order
from app.repositories.order import order_repository
from app.schemas.order import OrderValidate


class ShopifyService:
    """
    Service for Shopify-related business logic.

    Orchestrates the validation flow:
    1. Get order from DB (with tenant)
    2. Create Shopify client with tenant credentials
    3. Call Shopify GraphQL to complete draft order
    4. Update order in DB
    """

    async def validate_and_complete_order(
        self,
        db: Session,
        order_id: int,
        validate_data: OrderValidate | None = None,
    ) -> Order:
        """
        Validate payment and complete draft order in Shopify.

        This is the main flow:
        1. Get order with tenant (to access Shopify credentials)
        2. Verify order hasn't been validated already
        3. Create Shopify client with tenant's credentials
        4. Call Shopify GraphQL mutation to complete draft order
        5. Update order in DB with validation info

        Args:
            db: Database session
            order_id: Order ID to validate
            validate_data: Optional validation data (payment method, notes)

        Returns:
            Updated order

        Raises:
            ValueError: If order not found, already validated, or Shopify call fails
        """
        # 1. Get order with tenant relationship
        order = order_repository.get_with_tenant(db, order_id)
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        # 2. Check if already validated
        if order.validado:
            raise ValueError(
                f"Order {order_id} has already been validated at {order.validated_at}"
            )

        # 3. Get tenant and Shopify credentials
        tenant = order.tenant
        if not tenant:
            raise ValueError(f"Tenant not found for order {order_id}")

        # 4. Create Shopify client with tenant's credentials
        shopify_client = ShopifyClient(
            store_url=tenant.shopify_store_url,
            access_token=tenant.shopify_access_token,
            api_version=tenant.shopify_api_version,
        )

        # 5. Call Shopify GraphQL to complete draft order
        try:
            shopify_result = await shopify_client.complete_draft_order(
                order.shopify_draft_order_id
            )
        except Exception as e:
            raise ValueError(f"Failed to complete draft order in Shopify: {str(e)}")

        # 6. Update order in DB
        order.validado = True
        order.validated_at = datetime.utcnow()
        order.shopify_order_id = shopify_result.get("order_id")
        order.status = "completed"

        # Add optional validation data
        if validate_data:
            if validate_data.payment_method:
                order.payment_method = validate_data.payment_method
            if validate_data.notes:
                order.notes = validate_data.notes

        db.add(order)
        db.commit()
        db.refresh(order)

        return order

    async def get_draft_order_details(
        self,
        db: Session,
        order_id: int,
    ) -> dict:
        """
        Get draft order details from Shopify.

        Args:
            db: Database session
            order_id: Order ID

        Returns:
            dict: Draft order details from Shopify

        Raises:
            ValueError: If order not found or Shopify call fails
        """
        # Get order with tenant
        order = order_repository.get_with_tenant(db, order_id)
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        tenant = order.tenant
        if not tenant:
            raise ValueError(f"Tenant not found for order {order_id}")

        # Create Shopify client
        shopify_client = ShopifyClient(
            store_url=tenant.shopify_store_url,
            access_token=tenant.shopify_access_token,
            api_version=tenant.shopify_api_version,
        )

        # Get draft order from Shopify
        try:
            draft_order = await shopify_client.get_draft_order(order.shopify_draft_order_id)
            return draft_order
        except Exception as e:
            raise ValueError(f"Failed to get draft order from Shopify: {str(e)}")


# Global service instance
shopify_service = ShopifyService()
