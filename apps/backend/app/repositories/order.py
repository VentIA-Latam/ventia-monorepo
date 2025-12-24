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
    ) -> list[Order]:
        """
        Get all orders for a specific tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number to skip
            limit: Max results
            validado: Filter by validation status (None = all orders)

        Returns:
            List of orders
        """
        query = db.query(Order).filter(Order.tenant_id == tenant_id)

        # Apply validation filter if specified
        if validado is not None:
            query = query.filter(Order.validado == validado)

        return query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    def get_with_tenant(self, db: Session, order_id: int) -> Order | None:
        """
        Get order with tenant relationship loaded.

        Args:
            db: Database session
            order_id: Order ID

        Returns:
            Order with tenant or None
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
