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
        """Get order with tenant relationship loaded."""
        return order_repository.get_with_tenant(db, order_id)

    def get_orders_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
        validado: bool | None = None,
    ) -> OrderListResponse:
        """
        Get orders for a tenant with pagination.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number to skip
            limit: Max results
            validado: Filter by validation status

        Returns:
            OrderListResponse with total count and items
        """
        orders = order_repository.get_by_tenant(
            db,
            tenant_id,
            skip=skip,
            limit=limit,
            validado=validado,
        )

        total = order_repository.count_by_tenant(db, tenant_id, validado=validado)

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

    def create_order(self, db: Session, order_in: OrderCreate) -> Order:
        """
        Create a new order.

        Args:
            db: Database session
            order_in: Order creation data

        Returns:
            Created order

        Raises:
            ValueError: If order with same draft_order_id already exists for tenant
        """
        # Check if order with same draft_order_id already exists for tenant
        existing = order_repository.get_by_shopify_draft_id(
            db,
            order_in.tenant_id,
            order_in.shopify_draft_order_id,
        )
        if existing:
            raise ValueError(
                f"Order with draft order ID {order_in.shopify_draft_order_id} "
                f"already exists for tenant {order_in.tenant_id}"
            )

        return order_repository.create(db, obj_in=order_in)

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
