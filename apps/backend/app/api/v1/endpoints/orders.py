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
    OrderCancel,
    OrderCreate,
    OrderListResponse,
    OrderResponse,
    OrderUpdate,
    OrderValidate,
)
from app.schemas.invoice import InvoiceCreate, InvoiceResponse
from app.services.order import order_service
from app.services.invoice import invoice_service
from app.services.ecommerce import ecommerce_service
from app.services.messaging_service import messaging_service
from app.repositories.order import order_repository
from app.integrations.woocommerce_client import (
    WooCommerceAuthError,
    WooCommerceNotFoundError,
    WooCommerceError,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# De momento
@router.get("/recent", response_model=OrderListResponse, tags=["orders"])
async def get_recent_orders(
    limit: int = 5,
    current_user: User = Depends(get_current_user_or_api_key),
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
    current_user: User = Depends(get_current_user_or_api_key),
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


@router.patch("/{order_id}", response_model=OrderResponse, tags=["orders"])
async def update_order(
    order_id: int,
    order_in: OrderUpdate,
    current_user: User = Depends(require_permission_dual("PATCH", "/orders/*")),
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
    Validate payment and complete order in e-commerce platform (Shopify/WooCommerce).

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **Access Control:**
    - SUPERADMIN, ADMIN and VENTAS roles can validate orders
    - ADMIN/VENTAS can only validate orders from their own tenant
    - SUPERADMIN can validate orders from any tenant

    **Validation Flow:**
    1. Verify user has permission (SUPERADMIN, ADMIN or VENTAS)
    2. Verify order belongs to user's tenant (for non-SUPERADMIN)
    3. Check platform coherence (Shopify needs shopify_draft_order_id, WooCommerce needs woocommerce_order_id)
    4. Use unified ecommerce_service to validate and sync
    5. Update order with validation info:
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
        HTTPException 400: If platform/sync coherence check fails
        HTTPException 401: If e-commerce credentials are invalid
        HTTPException 502: For other e-commerce API errors
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

    # Get tenant settings for platform and sync configuration
    tenant = order.tenant
    settings = tenant.get_settings()
    platform = settings.platform
    sync_enabled = settings.ecommerce.sync_on_validation if settings.ecommerce else False

    logger.info(
        f"ecommerce_validate_start: order_id={order_id}, tenant_id={tenant.id}, "
        f"platform={platform}, sync_enabled={sync_enabled}, order_source={order.source_platform}"
    )

    # === COHERENCE CHECKS ===
    # If sync is enabled, verify order has the required platform ID
    if sync_enabled and settings.has_ecommerce:
        if platform == "shopify" and not order.shopify_draft_order_id:
            logger.warning(
                f"Coherence check failed: order_id={order_id}, platform=shopify but no shopify_draft_order_id"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sync enabled for Shopify but order has no shopify_draft_order_id. "
                       "Cannot sync order that was not created from Shopify.",
            )
        
        if platform == "woocommerce" and not order.woocommerce_order_id:
            logger.warning(
                f"Coherence check failed: order_id={order_id}, platform=woocommerce but no woocommerce_order_id"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sync enabled for WooCommerce but order has no woocommerce_order_id. "
                       "Cannot sync order that was not created from WooCommerce.",
            )

    try:
        # Extract payment method and notes from validate_data
        payment_method = validate_data.payment_method if validate_data else None
        notes = validate_data.notes if validate_data else None

        # Use unified e-commerce service for validation
        validated_order = await ecommerce_service.validate_order(
            db=db,
            order=order,
            payment_method=payment_method,
            notes=notes,
        )

        logger.info(
            f"ecommerce_validate_success: order_id={order_id}, platform={platform}, "
            f"shopify_order_id={validated_order.shopify_order_id}, "
            f"woocommerce_order_id={validated_order.woocommerce_order_id}"
        )

        # Auto-transition linked conversation to "sale" stage (post-sale)
        if validated_order.messaging_conversation_id:
            try:
                stage_result = await messaging_service.update_conversation_stage(
                    tenant_id=validated_order.tenant_id,
                    conversation_id=str(validated_order.messaging_conversation_id),
                    stage="sale",
                )
                if stage_result:
                    logger.info(
                        f"conversation_stage_updated: order_id={order_id}, "
                        f"conversation_id={validated_order.messaging_conversation_id}, stage=sale"
                    )
                else:
                    logger.warning(
                        f"conversation_stage_update_failed: order_id={order_id}, "
                        f"conversation_id={validated_order.messaging_conversation_id}"
                    )
            except Exception as stage_err:
                logger.warning(
                    f"conversation_stage_update_error: order_id={order_id}, error={stage_err}"
                )

            # Auto-remove "en-revisión" label after payment validation
            try:
                labels_result = await messaging_service.get_conversation_labels(
                    tenant_id=validated_order.tenant_id,
                    conversation_id=str(validated_order.messaging_conversation_id),
                )
                if labels_result:
                    labels = labels_result.get("data", labels_result)
                    if isinstance(labels, list):
                        for label in labels:
                            if label.get("title") == "en-revisión":
                                await messaging_service.remove_conversation_label(
                                    tenant_id=validated_order.tenant_id,
                                    conversation_id=str(validated_order.messaging_conversation_id),
                                    label_id=str(label["id"]),
                                )
                                logger.info(
                                    f"label_removed: order_id={order_id}, label=en-revisión, "
                                    f"conversation_id={validated_order.messaging_conversation_id}"
                                )
                                break
            except Exception as label_err:
                logger.warning(
                    f"label_removal_error: order_id={order_id}, error={label_err}"
                )

        return validated_order

    except ValueError as e:
        # Coherence errors from ecommerce_service
        logger.error(
            f"ecommerce_validate_error: order_id={order_id}, error=ValueError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except WooCommerceAuthError as e:
        # WooCommerce authentication failed (401)
        logger.error(
            f"ecommerce_validate_error: order_id={order_id}, error=WooCommerceAuthError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de e-commerce inválidas. Verifique la configuración de WooCommerce.",
        )

    except WooCommerceNotFoundError as e:
        # WooCommerce order not found (404)
        logger.error(
            f"ecommerce_validate_error: order_id={order_id}, error=WooCommerceNotFoundError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orden no encontrada en e-commerce (WooCommerce ID: {order.woocommerce_order_id})",
        )

    except WooCommerceError as e:
        # Other WooCommerce API errors
        logger.error(
            f"ecommerce_validate_error: order_id={order_id}, error=WooCommerceError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al comunicarse con e-commerce: {str(e)}",
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise

    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(
            f"ecommerce_validate_error: order_id={order_id}, error=Exception: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al validar orden: {str(e)}",
        )


@router.post("/{order_id}/cancel", response_model=OrderResponse, tags=["orders"])
async def cancel_order(
    order_id: int,
    cancel_data: OrderCancel,
    current_user: User = Depends(require_permission_dual("POST", "/orders/*/cancel")),
    db: Session = Depends(get_database),
) -> OrderResponse:
    """
    Cancel an order and sync cancellation to e-commerce platform (Shopify/WooCommerce).

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **Access Control:**
    - SUPERADMIN, ADMIN and VENTAS roles can cancel orders
    - ADMIN/VENTAS can only cancel orders from their own tenant
    - SUPERADMIN can cancel orders from any tenant

    **Cancel Flow:**
    - Shopify draft (not validated): permanently deletes the draft order
    - Shopify completed (validated): cancels with reason, refund method, restock and notify options
    - WooCommerce: sets order status to cancelled via REST API
    - In all cases: local order status is set to "Cancelado"

    Args:
        order_id: Order ID to cancel
        cancel_data: Cancellation options (reason, restock, refund method, staff note)
        current_user: Current authenticated user or API key
        db: Database session

    Returns:
        Cancelled order with status="Cancelado"

    Raises:
        HTTPException 404: If order not found
        HTTPException 403: If order belongs to different tenant
        HTTPException 400: If order is already cancelled or sync fails
        HTTPException 401: If e-commerce credentials are invalid
        HTTPException 502: For other e-commerce API errors
    """
    order = order_service.get_order(db, order_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )

    if current_user.role != Role.SUPERADMIN and order.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this order",
        )

    if order.status == "Cancelado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order {order_id} is already cancelled",
        )

    try:
        cancelled_order = await ecommerce_service.cancel_order(
            db=db,
            order=order,
            cancel_data=cancel_data,
        )

        logger.info(
            f"ecommerce_cancel_success: order_id={order_id}, "
            f"platform={order.source_platform}"
        )

        return cancelled_order

    except ValueError as e:
        logger.error(
            f"ecommerce_cancel_error: order_id={order_id}, error=ValueError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except WooCommerceAuthError as e:
        logger.error(
            f"ecommerce_cancel_error: order_id={order_id}, error=WooCommerceAuthError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de e-commerce inválidas. Verifique la configuración de WooCommerce.",
        )

    except WooCommerceNotFoundError as e:
        logger.error(
            f"ecommerce_cancel_error: order_id={order_id}, error=WooCommerceNotFoundError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Orden no encontrada en e-commerce (WooCommerce ID: {order.woocommerce_order_id})",
        )

    except WooCommerceError as e:
        logger.error(
            f"ecommerce_cancel_error: order_id={order_id}, error=WooCommerceError: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error al comunicarse con e-commerce: {str(e)}",
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"ecommerce_cancel_error: order_id={order_id}, error=Exception: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error inesperado al cancelar orden: {str(e)}",
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