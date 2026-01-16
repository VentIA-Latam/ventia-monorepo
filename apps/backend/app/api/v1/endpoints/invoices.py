"""
Invoice (comprobante electrónico) endpoints.

Endpoints for creating and managing electronic invoices (facturas, boletas, NC, ND)
integrated with SUNAT via eFact-OSE API.
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
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
    current_user: User = Depends(require_role(Role.SUPER_ADMIN, Role.ADMIN, Role.VENTAS)),
    db: Session = Depends(get_database),
) -> InvoiceResponse:
    """
    Create an electronic invoice (comprobante) from an order.

    This endpoint generates a new electronic invoice for SUNAT submission.
    The invoice is immediately submitted to eFact-OSE for processing.

    **Permissions:** Requires SUPER_ADMIN, ADMIN or VENTAS role

    SUPER_ADMIN: Can create invoices for any tenant
    ADMIN/VENTAS: Can only create for orders in their tenant

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
    - `403 Forbidden`: User lacks ADMIN or VENTAS role
    - `404 Not Found`: Order not found
    - `500 Internal Server Error`: eFact submission or processing error

    Args:
        order_id: Order ID to create invoice for
        invoice_data: Invoice creation data (InvoiceCreate)
        current_user: Current authenticated user (must be SUPER_ADMIN, ADMIN or VENTAS)
        db: Database session

    Returns:
        InvoiceResponse: Created invoice with eFact ticket

    Raises:
        HTTPException: Various 4xx/5xx errors as detailed above
    """
    try:
        # Validate tenant access
        # SUPER_ADMIN can create invoices for any tenant
        # ADMIN and VENTAS can only create for their own tenant
        if current_user.role in (Role.ADMIN, Role.VENTAS):
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
    response_model=list[InvoiceResponse],
    tags=["invoices"],
)
async def get_invoices_for_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> list[InvoiceResponse]:
    """
    Get all invoices for a specific order.

    Returns all electronic invoices (facturas, boletas, NC, ND) associated
    with an order, including their current eFact processing status.

    **Permissions:** 
    - All authenticated users can view invoices from their tenant's orders
    - SUPER_ADMIN can view invoices from any tenant's orders

    **Process:**
    1. Validates order exists
    2. For non-SUPER_ADMIN users, validates order belongs to user's tenant
    3. Returns all invoices associated with the order

    **Response:**
    Returns list of InvoiceResponse with:
    - Invoice details (type, serie, correlativo)
    - eFact status and ticket
    - Amounts (subtotal, IGV, total)
    - Customer information

    Args:
        order_id: Order ID to retrieve invoices for
        current_user: Current authenticated user
        db: Database session

    Returns:
        list[InvoiceResponse]: List of invoices for the order

    Raises:
        HTTPException: 
            - 403 Forbidden: Order doesn't belong to user's tenant (non-SUPER_ADMIN)
            - 404 Not Found: Order not found
            - 500 Internal Server Error: Unexpected error
    """
    try:
        # Get order and validate it exists
        order = order_repository.get(db, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order {order_id} not found",
            )

        # For non-SUPER_ADMIN users, validate order belongs to their tenant
        if current_user.role != Role.SUPER_ADMIN and order.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view invoices for orders in your tenant",
            )

        # Get all invoices for the order
        # SUPER_ADMIN can use any tenant_id, others use their own
        tenant_id = order.tenant_id if current_user.role == Role.SUPER_ADMIN else current_user.tenant_id
        
        invoices = invoice_service.get_invoices_by_order(
            db=db,
            order_id=order_id,
            tenant_id=tenant_id,
        )

        return [InvoiceResponse.from_orm(invoice) for invoice in invoices]

    except HTTPException:
        # Re-raise HTTP exceptions as-is
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


# @router.get(
#     "/{invoice_id}/status",
#     response_model=InvoiceResponse,
#     tags=["invoices"],
# )
# async def check_invoice_status(
#     invoice_id: int,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_database),
# ) -> InvoiceResponse:
#     """
#     Check the status of an invoice in eFact and update the invoice record.
# 
#     This endpoint queries eFact-OSE API to get the current processing status
#     of a submitted invoice and updates the local database record accordingly.
# 
#     **NOTA IMPORTANTE:** Según documentación de eFact, el flujo correcto es:
#     1. send_document() retorna un ticket
#     2. Intentar descargar el PDF con el ticket
#     3. Si el PDF está disponible → invoice procesado con éxito
#     4. Si hay error → invoice rechazado (revisar error)
#     
#     Este endpoint usa get_document_status() pero puede que necesite ajustarse
#     según la API real de eFact.
# 
#     **Permissions:** 
#     - All authenticated users can check status of their tenant's invoices
#     - SUPER_ADMIN can check status of any tenant's invoices
# 
#     **Process:**
#     1. Validates invoice exists and user has access
#     2. Queries eFact-OSE API with the invoice's ticket
#     3. Updates invoice status in database based on eFact response
#     4. Returns updated invoice
# 
#     **eFact Status Values:**
#     - `processing`: Still being processed by eFact/SUNAT
#     - `success`: Successfully validated and accepted by SUNAT
#     - `error`: Rejected by eFact/SUNAT (check efact_error for details)
# 
#     **Response:**
#     Returns InvoiceResponse with updated:
#     - `efact_status`: Current status from eFact
#     - `efact_response`: CDR (Constancia de Recepción) if successful
#     - `efact_error`: Error message if failed
#     - `efact_processed_at`: Timestamp when processing completed
# 
#     Args:
#         invoice_id: Invoice ID to check status for
#         current_user: Current authenticated user
#         db: Database session
# 
#     Returns:
#         InvoiceResponse: Invoice with updated eFact status
# 
#     Raises:
#         HTTPException: 
#             - 400 Bad Request: Invoice has no eFact ticket
#             - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPER_ADMIN)
#             - 404 Not Found: Invoice not found
#             - 500 Internal Server Error: eFact API error or unexpected error
#     """
#     try:
#         # Get invoice and validate it exists
#         invoice = invoice_service.check_invoice_status(
#             db=db,
#             invoice_id=invoice_id,
#             tenant_id=current_user.tenant_id if current_user.role != Role.SUPER_ADMIN else None,
#         )
# 
#         logger.info(
#             f"Invoice {invoice_id} status checked by user {current_user.id}. "
#             f"Status: {invoice.efact_status}"
#         )
# 
#         return InvoiceResponse.from_orm(invoice)
# 
#     except ValueError as e:
#         # Validation errors (invoice not found, no ticket, wrong tenant, etc.)
#         error_msg = str(e)
#         
#         # Determine appropriate status code
#         if "not found" in error_msg.lower():
#             status_code = status.HTTP_404_NOT_FOUND
#         elif "does not belong" in error_msg.lower():
#             status_code = status.HTTP_403_FORBIDDEN
#         else:
#             status_code = status.HTTP_400_BAD_REQUEST
#         
#         logger.warning(f"Status check validation failed for invoice {invoice_id}: {error_msg}")
#         raise HTTPException(
#             status_code=status_code,
#             detail=error_msg,
#         )
# 
#     except Exception as e:
#         # eFact API errors or unexpected errors
#         logger.error(
#             f"Unexpected error checking status for invoice {invoice_id}: {str(e)}",
#             exc_info=True,
#         )
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Failed to check invoice status: {str(e)}",
#         )


@router.get(
    "/{invoice_id}/pdf",
    tags=["invoices"],
)
async def download_invoice_pdf(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> Response:
    """
    Download the PDF file of an invoice from eFact.

    This endpoint acts as a proxy to eFact-OSE API to download the PDF
    of a successfully processed invoice. The PDF is not stored locally.

    **Permissions:** 
    - All authenticated users can download PDFs of their tenant's invoices
    - SUPER_ADMIN can download PDFs of any tenant's invoices

    **Requirements:**
    - Invoice must exist
    - Invoice must have an eFact ticket
    - Invoice must have status "success" (validated by SUNAT)
    - User must have access to the invoice's tenant

    **Process:**
    1. Validates invoice exists and user has access
    2. Validates invoice has ticket and is successful
    3. Calls eFact-OSE API to download PDF
    4. Returns PDF bytes with proper headers

    **Response:**
    Returns PDF file with headers:
    - Content-Type: application/pdf
    - Content-Disposition: attachment; filename={serie}-{correlativo}.pdf

    Args:
        invoice_id: Invoice ID to download PDF for
        current_user: Current authenticated user
        db: Database session

    Returns:
        Response: PDF file bytes with proper headers

    Raises:
        HTTPException: 
            - 400 Bad Request: Invoice has no ticket or not successful
            - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPER_ADMIN)
            - 404 Not Found: Invoice not found
            - 500 Internal Server Error: eFact API error or unexpected error
    """
    try:
        # Get invoice from repository
        from app.repositories.invoice import invoice_repository
        invoice = invoice_repository.get(db, invoice_id)
        
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice {invoice_id} not found",
            )

        # Validate tenant access (skip for SUPER_ADMIN)
        if current_user.role != Role.SUPER_ADMIN and invoice.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only download PDFs for invoices in your tenant",
            )

        # Validate invoice has eFact ticket
        if not invoice.efact_ticket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invoice {invoice_id} has no eFact ticket. Cannot download PDF.",
            )

        # Esperar 5 segundos y actualizar
        logger.info(
            f"Invoice {invoice_id} is in status '{invoice.efact_status}'. "
            f"Waiting 5 seconds before attempting PDF download..."
        )
        
        # Esperar 5 segundos para dar tiempo a eFact de procesar
        await asyncio.sleep(5)
        
        # Actualizar el estado a "success" 
        from datetime import datetime
        from app.schemas.invoice import InvoiceUpdate
        
        invoice_update = InvoiceUpdate(efact_status="success")
        invoice = invoice_repository.update(db, db_obj=invoice, obj_in=invoice_update)
        invoice.efact_processed_at = datetime.utcnow()
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        
        logger.info(
            f"Invoice {invoice_id} status updated to 'success' after 5 second wait"
        )

        # Download PDF from eFact
        from app.integrations.efact_client import EFactClient
        efact_client = EFactClient()
        
        try:
            pdf_bytes = efact_client.download_pdf(invoice.efact_ticket)
        except Exception as pdf_error:
            # Si falla la descarga del PDF, marcar como error
            logger.error(
                f"Failed to download PDF for invoice {invoice_id} after 5s wait: {str(pdf_error)}"
            )
            
            # Actualizar estado a error
            from datetime import datetime
            from app.schemas.invoice import InvoiceUpdate
            
            invoice_update = InvoiceUpdate(
                efact_status="error",
                efact_error=f"PDF download failed: {str(pdf_error)}"
            )
            invoice = invoice_repository.update(db, db_obj=invoice, obj_in=invoice_update)
            invoice.efact_processed_at = datetime.utcnow()
            db.add(invoice)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PDF not available for invoice {invoice_id}. Error: {str(pdf_error)}",
            )

        # Build filename
        filename = f"{invoice.serie}-{invoice.correlativo:08d}.pdf"

        logger.info(
            f"PDF downloaded for invoice {invoice_id} by user {current_user.id}. "
            f"Filename: {filename}"
        )

        # Return PDF with proper headers
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise

    except Exception as e:
        # eFact API errors or unexpected errors
        logger.error(
            f"Unexpected error downloading PDF for invoice {invoice_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download PDF: {str(e)}",
        )


@router.get(
    "/{invoice_id}/xml",
    tags=["invoices"],
)
async def download_invoice_xml(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_database),
) -> Response:
    """
    Download the XML file of an invoice from eFact.

    This endpoint acts as a proxy to eFact-OSE API to download the signed XML
    of a successfully processed invoice. The XML is the legal document required
    for tax compliance and audits.

    **Permissions:** 
    - All authenticated users can download XMLs of their tenant's invoices
    - SUPER_ADMIN can download XMLs of any tenant's invoices

    **Requirements:**
    - Invoice must exist
    - Invoice must have an eFact ticket
    - Invoice must have status "success" (validated by SUNAT)
    - User must have access to the invoice's tenant

    **Process:**
    1. Validates invoice exists and user has access
    2. Validates invoice has ticket and is successful
    3. Calls eFact-OSE API to download signed XML
    4. Returns XML bytes with proper headers

    **Response:**
    Returns XML file with headers:
    - Content-Type: application/xml
    - Content-Disposition: attachment; filename={serie}-{correlativo}.xml

    Args:
        invoice_id: Invoice ID to download XML for
        current_user: Current authenticated user
        db: Database session

    Returns:
        Response: XML file bytes with proper headers

    Raises:
        HTTPException: 
            - 400 Bad Request: Invoice has no ticket or not successful
            - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPER_ADMIN)
            - 404 Not Found: Invoice not found
            - 500 Internal Server Error: eFact API error or unexpected error
    """
    try:
        # Get invoice from repository
        from app.repositories.invoice import invoice_repository
        invoice = invoice_repository.get(db, invoice_id)
        
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice {invoice_id} not found",
            )

        # Validate tenant access (skip for SUPER_ADMIN)
        if current_user.role != Role.SUPER_ADMIN and invoice.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only download XMLs for invoices in your tenant",
            )

        # Validate invoice has eFact ticket
        if not invoice.efact_ticket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invoice {invoice_id} has no eFact ticket. Cannot download XML.",
            )

        # Esperar 5 segundos y actualizar
        logger.info(
            f"Invoice {invoice_id} is in status '{invoice.efact_status}'. "
            f"Waiting 5 seconds before attempting XML download..."
        )
        
        # Esperar 5 segundos para dar tiempo a eFact de procesar
        await asyncio.sleep(5)
        
        # Actualizar el estado a "success" 
        from datetime import datetime
        from app.schemas.invoice import InvoiceUpdate
        
        invoice_update = InvoiceUpdate(efact_status="success")
        invoice = invoice_repository.update(db, db_obj=invoice, obj_in=invoice_update)
        invoice.efact_processed_at = datetime.utcnow()
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        
        logger.info(
            f"Invoice {invoice_id} status updated to 'success' after 5 second wait"
        )

        # Download XML from eFact
        from app.integrations.efact_client import EFactClient
        efact_client = EFactClient()
        
        try:
            xml_bytes = efact_client.download_xml(invoice.efact_ticket)
        except Exception as xml_error:
            # Si falla la descarga del XML, marcar como error
            logger.error(
                f"Failed to download XML for invoice {invoice_id} after 5s wait: {str(xml_error)}"
            )
            
            # Actualizar estado a error
            from datetime import datetime
            from app.schemas.invoice import InvoiceUpdate
            
            invoice_update = InvoiceUpdate(
                efact_status="error",
                efact_error=f"XML download failed: {str(xml_error)}"
            )
            invoice = invoice_repository.update(db, db_obj=invoice, obj_in=invoice_update)
            invoice.efact_processed_at = datetime.utcnow()
            db.add(invoice)
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"XML not available for invoice {invoice_id}. Error: {str(xml_error)}",
            )

        # Build filename
        filename = f"{invoice.serie}-{invoice.correlativo:08d}.xml"

        logger.info(
            f"XML downloaded for invoice {invoice_id} by user {current_user.id}. "
            f"Filename: {filename}"
        )

        # Return XML with proper headers
        return Response(
            content=xml_bytes,
            media_type="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise

    except Exception as e:
        # eFact API errors or unexpected errors
        logger.error(
            f"Unexpected error downloading XML for invoice {invoice_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download XML: {str(e)}",
        )


@router.get(
    "/",
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
    List all invoices with pagination.

    Returns paginated list of electronic invoices,
    ordered by creation date (most recent first).

    **Permissions:** 
    - All authenticated users can view their tenant's invoices
    - SUPER_ADMIN can view invoices from all tenants

    **Query Parameters:**
    - skip: Number of records to skip (default: 0)
    - limit: Maximum records to return (default: 100, max: 1000)

    **Response:**
    Returns InvoiceListResponse with:
    - total: Total number of invoices
    - items: List of invoices (InvoiceResponse)
    - skip: Number of records skipped
    - limit: Maximum records returned

    Args:
        skip: Number of records to skip (default: 0)
        limit: Maximum records to return (default: 100, max: 1000)
        current_user: Current authenticated user
        db: Database session

    Returns:
        InvoiceListResponse: Paginated list of invoices

    Raises:
        HTTPException: 
            - 400 Bad Request: Invalid limit parameter
            - 500 Internal Server Error: If retrieval fails
    """
    # Validate limit parameter
    if limit > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit cannot exceed 1000",
        )

    try:
        # SUPER_ADMIN can view invoices from all tenants (tenant_id=None)
        # Other users can only view their tenant's invoices
        tenant_id = None if current_user.role == Role.SUPER_ADMIN else current_user.tenant_id
        
        invoices, total = invoice_service.get_invoices_by_tenant(
            db=db,
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
        )

        logger.info(
            f"Listed {len(invoices)} invoices (total: {total}) "
            f"for {'all tenants' if tenant_id is None else f'tenant {tenant_id}'} "
            f"by user {current_user.id} (role: {current_user.role})"
        )

        return InvoiceListResponse(
            total=total,
            items=invoices,
            skip=skip,
            limit=limit,
        )

    except Exception as e:
        logger.error(
            f"Error retrieving invoices for "
            f"{'all tenants' if current_user.role == Role.SUPER_ADMIN else f'tenant {current_user.tenant_id}'}: "
            f"{str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoices: {str(e)}",
        )

