"""
Order management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_role
from app.core.permissions import Role
from app.models.user import User
from app.schemas.order import OrderListResponse, OrderResponse, OrderUpdate, OrderValidate
from app.services.order import order_service
from app.services.shopify import shopify_service

router = APIRouter()


@router.get("/", response_model=OrderListResponse, tags=["orders"])
async def list_orders(
    skip: int = 0,
    limit: int = 100,
    validado: bool | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> OrderListResponse:
    """
    List orders for current user's tenant.

    All authenticated users can view orders from their tenant.
    Results are automatically filtered by tenant.

    Args:
        skip: Number of records to skip
        limit: Maximum records to return
        validado: Filter by validation status (None = all orders)
        current_user: Current authenticated user
        db: Database session

    Returns:
        OrderListResponse with total count and items
    """
    orders = order_service.get_orders_by_tenant(
        db,
        current_user.tenant_id,
        skip=skip,
        limit=limit,
        validado=validado,
    )
    return orders


@router.get("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Get order by ID.

    All authenticated users can view orders from their tenant.

    Args:
        order_id: Order ID
        current_user: Current authenticated user
        db: Database session

    Returns:
        Order details

    Raises:
        HTTPException: If order not found or access denied
    """
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant
    if order.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this order",
        )

    return order


@router.put("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def update_order(
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(require_role(Role.ADMIN, Role.LOGISTICA)),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Update order.

    Only ADMIN and LOGISTICA can update orders.
    Can only update orders from their own tenant.

    Args:
        order_id: Order ID to update
        order_in: Update data
        current_user: Current authenticated user (ADMIN or LOGISTICA)
        db: Database session

    Returns:
        Updated order

    Raises:
        HTTPException: If order not found or access denied
    """
    # Get order to verify tenant
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant
    if order.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this order",
        )

    try:
        updated_order = order_service.update_order(db, order_id, order_in)
        return updated_order
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{order_id}/validate", response_model=OrderResponse, tags=["orders"])
async def validate_order(
    order_id: int,
    validate_data: OrderValidate | None = None,
    current_user: User = Depends(require_role(Role.ADMIN, Role.LOGISTICA)),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Validate payment and complete draft order in Shopify.

    **This is the main validation flow:**
    1. Verify user has permission (ADMIN or LOGISTICA)
    2. Verify order belongs to user's tenant
    3. Get tenant's Shopify credentials from database
    4. Call Shopify GraphQL API to complete draft order
    5. Update order in database with validation info

    Only ADMIN and LOGISTICA can validate orders.

    Args:
        order_id: Order ID to validate
        validate_data: Optional validation data (payment method, notes)
        current_user: Current authenticated user (ADMIN or LOGISTICA)
        db: Database session

    Returns:
        Validated order with Shopify order ID

    Raises:
        HTTPException: If order not found, already validated, access denied, or Shopify call fails
    """
    # Get order to verify tenant BEFORE calling Shopify
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant
    if order.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this order",
        )

    # Call Shopify service to validate and complete order
    try:
        validated_order = await shopify_service.validate_and_complete_order(
            db,
            order_id,
            validate_data,
        )
        return validated_order
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate order: {str(e)}",
        )


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["orders"])
async def delete_order(
    order_id: int,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: Session = Depends(get_database),
) -> None:
    """
    Delete order.

    Only ADMIN can delete orders.
    Can only delete orders from their own tenant.

    Args:
        order_id: Order ID to delete
        current_user: Current authenticated user (ADMIN only)
        db: Database session

    Raises:
        HTTPException: If order not found or access denied
    """
    # Get order to verify tenant
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant
    if order.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this order",
        )

    try:
        order_service.delete_order(db, order_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
