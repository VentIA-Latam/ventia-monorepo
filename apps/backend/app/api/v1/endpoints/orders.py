"""
Order management endpoints.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_current_user_or_api_key,
    get_database,
    require_permission_dual,
)
from app.core.permissions import Role
from app.models.user import User
from app.schemas.order import (
    OrderCreate,
    OrderListResponse,
    OrderResponse,
    OrderUpdate,
    OrderValidate,
)
from app.schemas.invoice import InvoiceCreate, InvoiceResponse
from app.services.order import order_service
from app.services.shopify import shopify_service
from app.services.invoice import invoice_service
from app.repositories.order import order_repository

logger = logging.getLogger(__name__)

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


@router.post("", response_model=OrderResponse, tags=["orders"])
async def create_order(
    order_in: OrderCreate,
    current_user: User = Depends(require_permission_dual("POST", "/orders")),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Create a new order.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    SUPERADMIN, ADMIN and VENTAS roles can create orders.
    The order is created for the current user's tenant (tenant_id is obtained from current_user).

    Args:
        order_in: Order creation data (shopify_draft_order_id and other fields, tenant_id is NOT required)
        current_user: Current authenticated user or API key (SUPERADMIN, ADMIN or VENTAS role required)
        db: Database session

    Returns:
        Created order

    Raises:
        HTTPException: If order creation fails or insufficient permissions
    """
    try:
        created_order = order_service.create_order(db, order_in, tenant_id=current_user.tenant_id)
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


@router.get("", response_model=OrderListResponse, tags=["orders"])
async def list_orders(
    skip: int = 0,
    limit: int = 100,
    validado: bool | None = None,
    tenant_id: int | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_user_or_api_key),
    db: Session = Depends(get_database),
) -> OrderListResponse:
    """
    List orders with role-based access control.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **SUPERADMIN Behavior:**
    - Can view all orders from all tenants
    - Optional query parameter `tenant_id` filters to specific tenant
    - If `tenant_id` not specified: returns all orders from all tenants
    - If `tenant_id` specified: returns orders from that specific tenant

    **Other Roles Behavior:**
    - Can only view orders from their own tenant
    - `tenant_id` parameter is ignored (always uses current_user.tenant_id)

    Args:
        skip: Number of records to skip (default: 0)
        limit: Maximum records to return (default: 100, max: 1000)
        validado: Filter by validation status (None = all orders)
        tenant_id: SUPERADMIN only - filter by specific tenant (optional)
        sort_by: Field to sort by (default: created_at)
        sort_order: Sort order 'asc' or 'desc' (default: desc)
        current_user: Current authenticated user
        db: Database session

    Returns:
        OrderListResponse with total count and items

    Raises:
        HTTPException: If retrieval fails
    """
    # Validate limit parameter
    if limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 1000",
        )

    try:
        # SUPERADMIN can see all orders
        if current_user.role == Role.SUPERADMIN:
            return order_service.get_all_orders(
                db,
                skip=skip,
                limit=limit,
                tenant_id=tenant_id,  # Optional filter
                validado=validado,
                sort_by=sort_by,
                sort_order=sort_order,
            )
        else:
            # Other roles: filtered to their tenant
            return order_service.get_orders_by_tenant(
                db,
                current_user.tenant_id,
                skip=skip,
                limit=limit,
                validado=validado,
                sort_by=sort_by,
                sort_order=sort_order,
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve orders: {str(e)}",
        )


@router.get("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user_or_api_key),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Get order by ID.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **SUPERADMIN Behavior:**
    - Can access any order by ID without tenant restrictions
    - Response includes `tenant` field with full tenant information
    - Access to orders from other tenants is logged for audit trail

    **Other Roles Behavior:**
    - Can only access orders from their own tenant
    - Response includes `tenant` field as None (user knows their own tenant)
    - Returns 403 Forbidden if attempting to access order from another tenant

    **Response Tenant Field:**
    - For SUPERADMIN: includes tenant details (id, name, slug, company_id, etc.)
    - For other roles: None (they already know their tenant)
    - Frontend can display tenant name to show which client the order belongs to
    
    Args:
        order_id: Order ID
        current_user: Current authenticated user or API key
        db: Database session

    Returns:
        OrderResponse with tenant field populated for SUPERADMIN

    Raises:
        HTTPException 404: If order not found
        HTTPException 403: If non-SUPERADMIN user tries to access order from another tenant
    """
    # Fetch order with appropriate strategy based on role
    if current_user.role == Role.SUPERADMIN:
        # SUPERADMIN: fetch with tenant info to show which customer
        order = order_service.get_order_with_tenant(db, order_id)
    else:
        # Other roles: regular fetch (tenant will be None)
        order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Role-based access control
    if current_user.role == Role.SUPERADMIN:
        # SUPERADMIN can access any order
        # Log if accessing order from another tenant for audit trail
        if order.tenant_id is not current_user.tenant_id:
            logger.info(
                f"SUPERADMIN '{current_user.email}' accessed order {order_id} from tenant {order.tenant_id} (not their tenant)"
            )
    else:
        # Other roles: verify order belongs to their tenant
        if order.tenant_id is not current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this order",
            )

    return order


@router.put("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def update_order(
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(require_permission_dual("PUT", "/orders/*")),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Update order.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **Access Control:**
    - SUPERADMIN, ADMIN and VENTAS roles can update orders
    - Tenant restriction applies to non-SUPERADMIN users
    - ADMIN/VENTAS can only update orders from their own tenant

    **Behavior:**
    - ADMIN/VENTAS can only update orders from their own tenant
    - SUPERADMIN can update orders from any tenant
    - If order belongs to different tenant (non-SUPERADMIN): returns 403 Forbidden
    - If order not found: returns 404 Not Found

    Args:
        order_id: Order ID to update
        order_in: Update data
        current_user: Current authenticated user (SUPERADMIN, ADMIN or VENTAS required)
        db: Database session

    Returns:
        Updated order

    Raises:
        HTTPException 404: If order not found
        HTTPException 403: If order belongs to different tenant (security restriction)
    """
    # Get order to verify tenant
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant (ADMIN/VENTAS only, SUPERADMIN can access any)
    if current_user.role != Role.SUPERADMIN and order.tenant_id != current_user.tenant_id:
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
    current_user: User = Depends(require_permission_dual("POST", "/orders/*/validate")),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Validate payment and complete order in Shopify.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **Access Control:**
    - SUPERADMIN, ADMIN and VENTAS roles can validate orders
    - ADMIN/VENTAS can only validate orders from their own tenant
    - SUPERADMIN can validate orders from any tenant

    **Validation Flow:**
    1. Verify user has permission (SUPERADMIN, ADMIN or VENTAS)
    2. Verify order belongs to user's tenant (for non-SUPERADMIN)
    3. Check if order is already validated (409 if yes)
    4. Check for idempotency (409 if already in Shopify)
    5. Verify tenant has Shopify credentials (424 if missing)
    6. Call Shopify API to complete draft order
    7. Update order with validation info:
       - validado = True
       - status = "Pagado"
       - validated_at = current datetime
       - payment_method (if provided)
       - notes (if provided)
       - updated_at (automatic)

    Args:
        order_id: Order ID to validate
        validate_data: Optional validation data (payment method, notes)
        current_user: Current authenticated user or API key (SUPERADMIN, ADMIN or VENTAS role required)
        db: Database session

    Returns:
        Validated order with updated status

    Raises:
        HTTPException 404: If order not found
        HTTPException 403: If order belongs to different tenant OR insufficient role
        HTTPException 400: If order already validated
        HTTPException 409: If order already completed in Shopify (idempotency check)
        HTTPException 424: If tenant lacks Shopify credentials
    """
    from datetime import datetime

    # Get order to verify tenant
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant (ADMIN/VENTAS only, SUPERADMIN can access any)
    if current_user.role != Role.SUPERADMIN and order.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this order",
        )

    # Check if already validated
    if order.validado is True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} has already been validated at {order.validated_at}",
        )

    # === SHOPIFY INTEGRATION ===
    # Check idempotency: if order already has shopify_order_id, it was completed before
    if order.shopify_order_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order {order_id} already completed in Shopify (Order ID: {order.shopify_order_id})",
        )

    # Check if tenant has Shopify credentials configured
    tenant = order.tenant
    if not tenant.shopify_access_token or not tenant.shopify_store_url:
        # Log this event for admin awareness
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"Tenant {tenant.id} ({tenant.name}) attempted to validate order but lacks Shopify credentials"
        )

        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=f"Tenant '{tenant.name}' does not have Shopify credentials configured. Please contact support.",
        )

    try:
        # Call Shopify service to complete draft order
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"shopify_validate_start: order_id={order_id}, tenant_id={tenant.id}")

        validated_order = await shopify_service.validate_and_complete_order(
            db,
            order_id,
            validate_data,
        )

        logger.info(
            f"shopify_validate_success: order_id={order_id}, "
            f"shopify_order_id={validated_order.shopify_order_id}"
        )

        return validated_order

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Log Shopify errors
        import logging
        logger = logging.getLogger(__name__)
        logger.error(
            f"shopify_validate_error: order_id={order_id}, error={str(e)}"
        )

        # Return appropriate error based on exception type
        error_msg = str(e)

        if "401" in error_msg or "Unauthorized" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Shopify authentication failed. Invalid access token.",
            )
        elif "404" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Draft order not found in Shopify: {error_msg}",
            )
        elif "422" in error_msg or "already completed" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Draft order already completed in Shopify: {error_msg}",
            )
        elif "429" in error_msg or "rate limit" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Shopify API rate limit exceeded. Please try again later.",
            )
        elif "timeout" in error_msg.lower() or "connection" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f"Shopify API timeout or connection error: {error_msg}",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to complete order in Shopify: {error_msg}",
            )

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
    current_user: User = Depends(require_permission_dual("DELETE", "/orders/*")),
    db: Session = Depends(get_database),
) -> None:
    """
    Delete order (soft delete).

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **Access Control:**
    - Only ADMIN role can delete orders
    - Tenant restriction applies to ALL users, including SUPERADMIN
    - A SUPERADMIN cannot delete orders from other tenants without being assigned to that tenant
    - This is a security measure to prevent accidental order deletions

    **Behavior:**
    - Order is marked as deleted (soft delete) but not removed from database
    - Historical data is preserved for audit trails
    - Users can only delete orders from their own tenant
    - If order belongs to different tenant: returns 403 Forbidden
    - If order not found: returns 404 Not Found

    **Future Enhancement:**
    - If SUPERADMIN order deletion is needed, separate history with additional confirmations required

    Args:
        order_id: Order ID to delete
        current_user: Current authenticated user (ADMIN role only)
        db: Database session

    Raises:
        HTTPException 404: If order not found
        HTTPException 403: If order belongs to different tenant (security restriction)
    """
    # Get order to verify tenant
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    # Verify order belongs to user's tenant (ADMIN only, SUPERADMIN can access any)
    if current_user.role != Role.SUPERADMIN and order.tenant_id != current_user.tenant_id:
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


# ============================================================================
# INVOICE ENDPOINTS (under /orders/{order_id}/invoices)
# ============================================================================


@router.post(
    "/{order_id}/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["orders", "invoices"],
)
async def create_invoice_for_order(
    order_id: int,
    invoice_data: InvoiceCreate,
    current_user: User = Depends(require_permission_dual("POST", "/orders/*/invoices")),
    db: Session = Depends(get_database),
) -> InvoiceResponse:
    """
    Create an electronic invoice (comprobante) from an order.

    This endpoint generates a new electronic invoice for SUNAT submission.
    The invoice is immediately submitted to eFact-OSE for processing.

    **Permissions:** Requires SUPERADMIN, ADMIN or VENTAS role

    SUPERADMIN: Can create invoices for any tenant
    ADMIN/VENTAS: Can only create for orders in their tenant

    **Request Body:**
    - `invoice_type`: Type of invoice (01=Factura, 03=Boleta, 07=Nota de Crédito, 08=Nota de Débito)
    - `serie`: Invoice series code (4 characters, e.g., "F001", "B001")
    - `reference_invoice_id`: (Optional) Referenced invoice ID for NC/ND
    - `reference_reason`: (Optional) Reason for credit/debit note
    - `cliente_tipo_documento`: (Optional) Customer document type (SUNAT catálogo 06). If not provided, uses order's customer_document_type
    - `cliente_numero_documento`: (Optional) Customer document number. If not provided, uses order's customer_document_number
    - `cliente_razon_social`: (Optional) Customer name/business name. If not provided, uses order's customer_name
    - `cliente_email`: (Optional) Customer email for invoice delivery. If not provided, uses order's customer_email

    **Valid Document Types (SUNAT catálogo 06):**
    - 0: Sin documento (for customers without identification)
    - 1: DNI (8 digits)
    - 4: Carnet de extranjería (8-12 characters)
    - 6: RUC (11 digits)
    - 7: Pasaporte (5-12 characters)
    - A: Cédula diplomática

    **Validation Rules:**
    - **Factura (01)**: REQUIRES RUC (cliente_tipo_documento=6) with exactly 11 digits
    - **Boleta (03)**: Accepts all document types (0, 1, 4, 6, 7, A)
    - **NC/ND (07/08)**: Same rules as the referenced invoice
    - Document number length is validated based on document type
    - Validation failures return HTTP 400 with detailed error messages

    **Process:**
    1. Validates order exists and is validated
    2. Uses provided customer data or falls back to order data
    3. Validates customer document type is consistent with invoice type
    4. Validates tenant has RUC configured
    5. Gets next correlativo from invoice series (thread-safe)
    6. Calculates totals from order line items
    7. Creates invoice record in database
    8. Generates JSON-UBL document
    9. Submits to eFact-OSE API
    10. Returns invoice with eFact ticket (status: "processing")

    Args:
        order_id: Order ID to create invoice for
        invoice_data: Invoice creation data (InvoiceCreate)
        current_user: Current authenticated user (must be SUPERADMIN, ADMIN or VENTAS)
        db: Database session

    Returns:
        InvoiceResponse: Created invoice with eFact ticket
    """
    try:
        # Validate tenant access
        if current_user.role in (Role.ADMIN, Role.VENTAS):
            order = order_repository.get(db, order_id)
            if not order or order.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create invoices for orders in your tenant",
                )

        # Create the invoice using the service
        tenant_id = None if current_user.role == Role.SUPERADMIN else current_user.tenant_id

        invoice = invoice_service.create_invoice(
            db=db,
            order_id=order_id,
            tenant_id=tenant_id,
            invoice_data=invoice_data,
            user_role=current_user.role,
        )

        logger.info(
            f"Invoice {invoice.id} created for order {order_id} by user {current_user.id}. "
            f"eFact ticket: {invoice.efact_ticket}"
        )

        return InvoiceResponse.from_orm(invoice)

    except ValueError as e:
        logger.warning(
            f"Invoice creation validation failed for order {order_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            f"Unexpected error creating invoice for order {order_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invoice: {str(e)}",
        )


@router.get(
    "/{order_id}/invoices",
    response_model=list[InvoiceResponse],
    tags=["orders", "invoices"],
)
async def get_invoices_for_order(
    order_id: int,
    current_user: User = Depends(require_permission_dual("GET", "/orders/*/invoices")),
    db: Session = Depends(get_database),
) -> list[InvoiceResponse]:
    """
    Get all invoices for a specific order.

    Returns all electronic invoices (facturas, boletas, NC, ND) associated
    with an order, including their current eFact processing status.

    **Permissions:**
    - All authenticated users can view invoices from their tenant's orders
    - SUPERADMIN can view invoices from any tenant's orders

    Args:
        order_id: Order ID to retrieve invoices for
        current_user: Current authenticated user
        db: Database session

    Returns:
        list[InvoiceResponse]: List of invoices for the order
    """
    try:
        # Get order and validate it exists
        order = order_repository.get(db, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found",
            )

        # For non-SUPERADMIN users, validate order belongs to their tenant
        if current_user.role != Role.SUPERADMIN and order.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view invoices for orders in your tenant",
            )

        # Get all invoices for the order
        tenant_id = order.tenant_id if current_user.role == Role.SUPERADMIN else current_user.tenant_id

        invoices = invoice_service.get_invoices_by_order(
            db=db,
            order_id=order_id,
            tenant_id=tenant_id,
        )

        return [InvoiceResponse.from_orm(invoice) for invoice in invoices]

    except HTTPException:
        raise

    except ValueError as e:
        logger.warning(f"Error retrieving invoices for order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        logger.error(
            f"Unexpected error retrieving invoices for order {order_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoices: {str(e)}",
        )