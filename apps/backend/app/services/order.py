"""
Order service - business logic for order management.
"""

from sqlalchemy.orm import Session

from app.models.order import Order
from app.repositories.order import order_repository
from app.schemas.order import OrderCreate, OrderListResponse, OrderUpdate


class OrderService:
    """Service for order-related business logic."""

    def get_order(self, db: Session, order_id: int) -> Order | None:
        """Get order by ID."""
        return order_repository.get(db, order_id)

    def get_order_with_tenant(self, db: Session, order_id: int) -> Order | None:
        """
        Get order with tenant relationship eagerly loaded.

        **Purpose:**
        - Loads the related Tenant object to populate the `tenant` field in OrderResponse
        - Used when SUPER_ADMIN needs to see which client an order belongs to
        - Prevents N+1 query problem by using eager loading (joinedload)

        **Usage in Endpoints:**
        - SUPER_ADMIN: Call this when responding with order details
        - Other roles: Can use regular get_order() since they only see their own tenant

        **Response Schema:**
        The returned Order object will populate the `tenant` field in OrderResponse:
        ```
        {
            "id": 123,
            "customer_email": "buyer@example.com",
            "tenant_id": 5,
            "validado": false,
            ...
            "tenant": {
                "id": 5,
                "name": "Acme Corp",
                "slug": "acme-corp-outlet",
                "company_id": "auth0|12345",
                ...
            }
        }
        ```

        Args:
            db: Database session
            order_id: Order ID to fetch

        Returns:
            Order with tenant relationship loaded, or None if not found
        """
        return order_repository.get_with_tenant(db, order_id)

    def get_orders_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
        validado: bool | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> OrderListResponse:
        """
        Get orders for a tenant with pagination.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number to skip
            limit: Max results
            validado: Filter by validation status
            sort_by: Field to sort by (default: created_at)
            sort_order: Sort order 'asc' or 'desc' (default: desc)

        Returns:
            OrderListResponse with total count and items
        """
        orders = order_repository.get_by_tenant(
            db,
            tenant_id,
            skip=skip,
            limit=limit,
            validado=validado,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        total = order_repository.count_by_tenant(db, tenant_id, validado=validado)

        return OrderListResponse(
            total=total,
            items=orders,
            skip=skip,
            limit=limit,
        )

    def get_all_orders(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        tenant_id: int | None = None,
        validado: bool | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> OrderListResponse:
        """
        Get all orders from all tenants (SUPER_ADMIN only).

        Args:
            db: Database session
            skip: Number to skip
            limit: Max results
            tenant_id: Optional filter by specific tenant
            validado: Optional filter by validation status
            sort_by: Field to sort by (default: created_at)
            sort_order: Sort order 'asc' or 'desc' (default: desc)

        Returns:
            OrderListResponse with total count and items
        """
        orders = order_repository.get_all(
            db,
            skip=skip,
            limit=limit,
            tenant_id=tenant_id,
            validado=validado,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        total = order_repository.count_all(
            db,
            tenant_id=tenant_id,
            validado=validado,
        )

        return OrderListResponse(
            total=total,
            items=orders,
            skip=skip,
            limit=limit,
        )

    def get_pending_validation(
        self,
        db: Session,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Order]:
        """Get orders pending validation for a tenant."""
        return order_repository.get_pending_validation(
            db,
            tenant_id,
            skip=skip,
            limit=limit,
        )

    def get_recent_orders(
        self,
        db: Session,
        tenant_id: int,
        limit: int = 5,
    ) -> list[Order]:
        """
        Get recent orders for a tenant, ordered by updated_at DESC.

        Args:
            db: Database session
            tenant_id: Tenant ID
            limit: Number of recent orders to return (default 5)

        Returns:
            List of recent orders ordered by updated_at descending
        """
        return order_repository.get_recent_orders(
            db,
            tenant_id,
            limit=limit,
        )

    def create_order(self, db: Session, order_in: OrderCreate, tenant_id: int) -> Order:
        """
        Create a new order.

        Args:
            db: Database session
            order_in: Order creation data
            tenant_id: Tenant ID from authenticated user

        Returns:
            Created order

        Raises:
            ValueError: If order with same draft_order_id already exists for tenant
        """
        # Check if order with same draft_order_id already exists for tenant
        existing = order_repository.get_by_shopify_draft_id(
            db,
            tenant_id,
            order_in.shopify_draft_order_id,
        )
        if existing:
            raise ValueError(
                f"Order with draft order ID {order_in.shopify_draft_order_id} "
                f"already exists for tenant {tenant_id}"
            )

        return order_repository.create(db, obj_in=order_in, tenant_id=tenant_id)

    def update_order(
        self,
        db: Session,
        order_id: int,
        order_in: OrderUpdate,
    ) -> Order:
        """
        Update order.

        Args:
            db: Database session
            order_id: Order ID to update
            order_in: Update data

        Returns:
            Updated order

        Raises:
            ValueError: If order not found
        """
        order = order_repository.get(db, order_id)
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        return order_repository.update(db, db_obj=order, obj_in=order_in)

    def delete_order(self, db: Session, order_id: int) -> Order:
        """
        Delete order.

        Args:
            db: Database session
            order_id: Order ID to delete

        Returns:
            Deleted order

        Raises:
            ValueError: If order not found
        """
        order = order_repository.get(db, order_id)
        if not order:
            raise ValueError(f"Order with ID {order_id} not found")

        return order_repository.delete(db, id=order_id)


# Global service instance
order_service = OrderService()
