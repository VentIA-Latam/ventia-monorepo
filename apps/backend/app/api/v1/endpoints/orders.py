"""
Order management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_database, require_role
from app.core.permissions import Role
from app.models.user import User
from app.schemas.order import (
    OrderCreate,
    OrderListResponse,
    OrderResponse,
    OrderUpdate,
    OrderValidate,
)
from app.services.order import order_service
from app.services.shopify import shopify_service

router = APIRouter()

# De momento
@router.get("/recent", response_model=OrderListResponse, tags=["orders"])
async def get_recent_orders(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> OrderListResponse:
    """
    Get the most recently updated orders for current user's tenant.

    All authenticated users can view recent orders from their tenant.
    Orders are sorted by updated_at in descending order.

    Args:
        limit: Number of recent orders to return (default 5, max 10)
        current_user: Current authenticated user
        db: Database session

    Returns:
        OrderListResponse with recent orders

    Raises:
        HTTPException: If retrieval fails or limit exceeds maximum
    """
    # Validate limit parameter
    if limit < 1 or limit > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 10",
        )

    try:
        recent_orders = order_service.get_recent_orders(
            db,
            current_user.tenant_id,
            limit=limit,
        )
        return OrderListResponse(
            total=len(recent_orders),
            items=recent_orders,
            skip=0,
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve recent orders: {str(e)}",
        )


@router.post("/", response_model=OrderResponse, tags=["orders"])
async def create_order(
    order_in: OrderCreate,
    current_user: User = Depends(require_role(Role.ADMIN, Role.LOGISTICA)),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Create a new order.

    Only ADMIN and LOGISTICA can create orders.
    The order is created for the current user's tenant.

    Args:
        order_in: Order creation data (include tenant_id and shopify_draft_order_id)
        current_user: Current authenticated user (ADMIN or LOGISTICA)
        db: Database session

    Returns:
        Created order

    Raises:
        HTTPException: If order creation fails
    """
    try:
        created_order = order_service.create_order(db, order_in)
        return created_order
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}",
        )


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
    Validate payment for an order.

    **Validation flow:**
    1. Verify user has permission (ADMIN or LOGISTICA)
    2. Verify order belongs to user's tenant
    3. Check if order is already validated
    4. Update order with validation info:
       - validado = True
       - status = "Pagado"
       - validated_at = current datetime
       - payment_method (if provided)
       - notes (if provided)
       - updated_at (automatic)

    Only ADMIN and LOGISTICA can validate orders.

    Args:
        order_id: Order ID to validate
        validate_data: Optional validation data (payment method, notes)
        current_user: Current authenticated user (ADMIN or LOGISTICA)
        db: Database session

    Returns:
        Validated order

    Raises:
        HTTPException: If order not found, already validated, or access denied
    """
    from datetime import datetime

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

    # Check if already validated
    if order.validado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} has already been validated at {order.validated_at}",
        )

    try:
        # Update order validation fields
        order.validado = True
        order.status = "Pagado"
        order.validated_at = datetime.utcnow()

        # Add optional validation data
        if validate_data:
            if validate_data.payment_method:
                order.payment_method = validate_data.payment_method
            if validate_data.notes:
                order.notes = validate_data.notes

        # Commit changes (updated_at is automatically set by onupdate)
        db.add(order)
        db.commit()
        db.refresh(order)

        return order

        # TODO: Integrate with Shopify when credentials are ready
        # validated_order = await shopify_service.validate_and_complete_order(
        #     db,
        #     order_id,
        #     validate_data,
        # )
        # return validated_order

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        db.rollback()
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