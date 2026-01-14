"""
Invoice (comprobante electrónico) endpoints.

Endpoints for creating and managing electronic invoices (facturas, boletas, NC, ND)
integrated with SUNAT via eFact-OSE API.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_database,
    require_permission,
    require_role,
)
from app.core.permissions import Role
from app.models.user import User
from app.repositories.order import order_repository
from app.schemas.invoice import InvoiceCreate, InvoiceListResponse, InvoiceResponse
from app.services.invoice import invoice_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/{order_id}/invoice",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["invoices"],
)
async def create_invoice_for_order(
    order_id: int,
    invoice_data: InvoiceCreate,
    current_user: User = Depends(require_role(Role.SUPER_ADMIN, Role.ADMIN, Role.LOGISTICA)),
    db: Session = Depends(get_database),
) -> InvoiceResponse:
    """
    Create an electronic invoice (comprobante) from an order.

    This endpoint generates a new electronic invoice for SUNAT submission.
    The invoice is immediately submitted to eFact-OSE for processing.

    **Permissions:** Requires SUPER_ADMIN, ADMIN or LOGISTICA role
    
    SUPER_ADMIN: Can create invoices for any tenant
    ADMIN/LOGISTICA: Can only create for orders in their tenant

    **Request Body:**
    - `invoice_type`: Type of invoice (01=Factura, 03=Boleta, 07=Nota de Crédito, 08=Nota de Débito)
    - `serie`: Invoice series code (4 characters, e.g., "F001", "B001")
    - `reference_invoice_id`: (Optional) Referenced invoice ID for NC/ND
    - `reference_reason`: (Optional) Reason for credit/debit note

    **Process:**
    1. Validates order exists and is validated
    2. Validates customer has document information
    3. Validates tenant has RUC configured
    4. Gets next correlativo from invoice series (thread-safe)
    5. Calculates totals from order line items
    6. Creates invoice record in database
    7. Generates JSON-UBL document
    8. Submits to eFact-OSE API
    9. Returns invoice with eFact ticket (status: "processing")

    **Response:**
    Returns the created invoice with:
    - `efact_status`: "processing" (ticket submitted to eFact)
    - `efact_ticket`: UUID for tracking with eFact

    **Error Handling:**
    - `400 Bad Request`: Order validation failed, missing RUC, etc.
    - `401 Unauthorized`: User not authenticated
    - `403 Forbidden`: User lacks ADMIN or LOGISTICA role
    - `404 Not Found`: Order not found
    - `500 Internal Server Error`: eFact submission or processing error

    Args:
        order_id: Order ID to create invoice for
        invoice_data: Invoice creation data (InvoiceCreate)
        current_user: Current authenticated user (must be SUPER_ADMIN, ADMIN or LOGISTICA)
        db: Database session

    Returns:
        InvoiceResponse: Created invoice with eFact ticket

    Raises:
        HTTPException: Various 4xx/5xx errors as detailed above
    """
    try:
        # Validate tenant access
        # SUPER_ADMIN can create invoices for any tenant
        # ADMIN and LOGISTICA can only create for their own tenant
        if current_user.role in (Role.ADMIN, Role.LOGISTICA):
            order = order_repository.get(db, order_id)
            if not order or order.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only create invoices for orders in your tenant",
                )

        # Create the invoice using the service
        # The service handles all validation, JSON-UBL generation, and eFact submission
        # For SUPER_ADMIN, pass None for tenant_id to use the order's tenant
        # For other roles, pass the user's tenant_id
        tenant_id = None if current_user.role == Role.SUPER_ADMIN else current_user.tenant_id
        
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
        # Validation errors (missing RUC, order not validated, etc.)
        logger.warning(
            f"Invoice creation validation failed for order {order_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except Exception as e:
        # Unexpected errors (eFact API errors, database errors, etc.)
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
    response_model=InvoiceListResponse,
    tags=["invoices"],
)
async def get_invoices_for_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> InvoiceListResponse:
    """
    Get all invoices for a specific order.

    Returns all electronic invoices (facturas, boletas, NC, ND) associated
    with an order, including their current eFact processing status.

    **Permissions:** All authenticated users can view invoices from their tenant's orders

    Args:
        order_id: Order ID to retrieve invoices for
        current_user: Current authenticated user
        db: Database session

    Returns:
        InvoiceListResponse: List of invoices for the order

    Raises:
        HTTPException: If order not found or access denied
    """
    try:
        invoices = invoice_service.get_invoices_by_order(
            db=db,
            order_id=order_id,
            tenant_id=current_user.tenant_id,
        )

        return InvoiceListResponse(
            total=len(invoices),
            items=invoices,
            skip=0,
            limit=len(invoices),
        )

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


@router.get(
    "/invoices",
    response_model=InvoiceListResponse,
    tags=["invoices"],
)
async def list_invoices(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> InvoiceListResponse:
    """
    List all invoices for the current user's tenant.

    Returns paginated list of all electronic invoices for the tenant,
    ordered by creation date (most recent first).

    **Permissions:** All authenticated users can view their tenant's invoices

    Args:
        skip: Number of records to skip (default: 0)
        limit: Maximum records to return (default: 100, max: 1000)
        current_user: Current authenticated user
        db: Database session

    Returns:
        InvoiceListResponse: Paginated list of invoices

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
        invoices, total = invoice_service.get_invoices_by_tenant(
            db=db,
            tenant_id=current_user.tenant_id,
            skip=skip,
            limit=limit,
        )

        return InvoiceListResponse(
            total=total,
            items=invoices,
            skip=skip,
            limit=limit,
        )

    except Exception as e:
        logger.error(
            f"Error retrieving invoices for tenant {current_user.tenant_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoices: {str(e)}",
        )

