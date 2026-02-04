"""
Order repository.
"""

from sqlalchemy.orm import Session, joinedload

from app.models.order import Order
from app.repositories.base import CRUDBase
from app.schemas.order import OrderCreate, OrderUpdate


class OrderRepository(CRUDBase[Order, OrderCreate, OrderUpdate]):
    """Repository for Order model."""

    def get_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
        validado: bool | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> list[Order]:
        """
        Get all orders for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number to skip
            limit: Max results
            validado: Filter by validation status (None = all orders)
            sort_by: Field to sort by (default: created_at)
            sort_order: Sort order 'asc' or 'desc' (default: desc)

        Returns:
            List of orders
        """
        query = db.query(Order).filter(Order.tenant_id == tenant_id)

        # Apply validation filter if specified
        if validado is not None:
            query = query.filter(Order.validado == validado)

        # Apply sorting
        sort_column = getattr(Order, sort_by, Order.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        return query.offset(skip).limit(limit).all()

    def get_all(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        tenant_id: int | None = None,
        validado: bool | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> list[Order]:
        """
        Get all orders from all tenants (for SUPERADMIN).

        Args:
            db: Database session
            skip: Number to skip
            limit: Max results
            tenant_id: Optional filter by tenant ID
            validado: Optional filter by validation status
            sort_by: Field to sort by (default: created_at)
            sort_order: Sort order 'asc' or 'desc' (default: desc)

        Returns:
            List of orders
        """
        query = db.query(Order)

        # Optional tenant filter (for SUPERADMIN with specific tenant)
        if tenant_id is not None:
            query = query.filter(Order.tenant_id == tenant_id)

        # Apply validation filter if specified
        if validado is not None:
            query = query.filter(Order.validado == validado)

        # Apply sorting
        sort_column = getattr(Order, sort_by, Order.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        return query.offset(skip).limit(limit).all()

    def count_all(
        self,
        db: Session,
        *,
        tenant_id: int | None = None,
        validado: bool | None = None,
    ) -> int:
        """
        Count all orders from all tenants.

        Args:
            db: Database session
            tenant_id: Optional filter by tenant ID
            validado: Optional filter by validation status

        Returns:
            Total count of orders
        """
        query = db.query(Order)

        if tenant_id is not None:
            query = query.filter(Order.tenant_id == tenant_id)

        if validado is not None:
            query = query.filter(Order.validado == validado)

        return query.count()

    def get_with_tenant(self, db: Session, order_id: int) -> Order | None:
        """
        Get order with tenant relationship eagerly loaded via joinedload.

        **Performance:**
        - Uses SQLAlchemy joinedload to load tenant in single query
        - Prevents N+1 query problem when accessing order.tenant

        **Usage:**
        - Call when response needs to include tenant information
        - Populates the `tenant` field in OrderResponse schema
        - Used by endpoints that serve SUPERADMIN (who needs to see all tenants)

        **Return Data:**
        Order object with order.tenant populated:
        ```python
        order = repo.get_with_tenant(db, 123)
        print(order.tenant.name)  # Single query, no N+1 problem
        ```

        Args:
            db: Database session
            order_id: Order ID to fetch

        Returns:
            Order with tenant relationship loaded, or None if not found
        """
        return (
            db.query(Order)
            .options(joinedload(Order.tenant))
            .filter(Order.id == order_id)
            .first()
        )

    def get_by_shopify_draft_id(
        self,
        db: Session,
        tenant_id: int,
        shopify_draft_order_id: str,
    ) -> Order | None:
        """
        Get order by Shopify draft order ID and tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            shopify_draft_order_id: Shopify draft order ID

        Returns:
            Order or None
        """
        return (
            db.query(Order)
            .filter(
                Order.tenant_id == tenant_id,
                Order.shopify_draft_order_id == shopify_draft_order_id,
            )
            .first()
        )

    def get_by_shopify_order_id(
        self,
        db: Session,
        tenant_id: int,
        shopify_order_id: str,
    ) -> Order | None:
        """
        Get order by Shopify order ID and tenant.

        Used when processing webhooks for completed orders (e.g., orders/paid).
        The order ID is the final Shopify order ID (not draft order ID).

        Args:
            db: Database session
            tenant_id: Tenant ID
            shopify_order_id: Shopify order ID (gid://shopify/Order/...)

        Returns:
            Order or None
        """
        return (
            db.query(Order)
            .filter(
                Order.tenant_id == tenant_id,
                Order.shopify_order_id == shopify_order_id,
            )
            .first()
        )

    def get_by_woocommerce_order_id(
        self,
        db: Session,
        tenant_id: int,
        woocommerce_order_id: int,
    ) -> Order | None:
        """
        Get order by WooCommerce order ID and tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            woocommerce_order_id: WooCommerce order ID

        Returns:
            Order or None
        """
        return (
            db.query(Order)
            .filter(
                Order.tenant_id == tenant_id,
                Order.woocommerce_order_id == woocommerce_order_id,
            )
            .first()
        )

    def get_pending_validation(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Order]:
        """
        Get orders pending validation for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number to skip
            limit: Max results

        Returns:
            List of unvalidated orders
        """
        return (
            db.query(Order)
            .filter(Order.tenant_id == tenant_id, Order.validado == False)
            .order_by(Order.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_recent_orders(
        self,
        db: Session,
        tenant_id: int,
        *,
        limit: int = 5,
    ) -> list[Order]:
        """
        Get most recently updated orders for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            limit: Number of recent orders to return (default 5)

        Returns:
            List of orders ordered by updated_at descending
        """
        return (
            db.query(Order)
            .filter(Order.tenant_id == tenant_id)
            .order_by(Order.updated_at.desc())
            .limit(limit)
            .all()
        )

    def count_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        validado: bool | None = None,
    ) -> int:
        """
        Count orders for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            validado: Filter by validation status

        Returns:
            Count of orders
        """
        query = db.query(Order).filter(Order.tenant_id == tenant_id)

        if validado is not None:
            query = query.filter(Order.validado == validado)

        return query.count()


# Global repository instance
order_repository = OrderRepository(Order)
