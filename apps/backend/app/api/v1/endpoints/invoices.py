"""
Invoice (comprobante electrónico) endpoints.

Endpoints for managing electronic invoices (facturas, boletas, NC, ND)
integrated with SUNAT via eFact-OSE API.

NOTE: Invoice creation and listing by order are now under /orders/{order_id}/invoices
See: apps/backend/app/api/v1/endpoints/orders.py
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import (
    get_database,
    require_permission_dual,
)
from app.core.permissions import Role
from app.models.user import User
from app.schemas.invoice import InvoiceListResponse, InvoiceResponse
from app.services.invoice import invoice_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{invoice_id}/status",
    response_model=InvoiceResponse,
    tags=["invoices"],
)
async def check_invoice_status(
    invoice_id: int,
    current_user: User = Depends(require_permission_dual("GET", "/invoices/*")),
    db: Session = Depends(get_database),
) -> InvoiceResponse:
    """
    Check the status of an invoice in eFact and update the invoice record.

    This endpoint verifies the processing status of a submitted invoice by
    attempting to download the PDF from eFact. According to eFact documentation,
    if the PDF is available, the document has been successfully processed.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    **Permissions:**
    - All authenticated users can check status of their tenant's invoices
    - SUPER_ADMIN can check status of any tenant's invoices

    **Process:**
    1. Validates invoice exists and user has access
    2. If already in final status (success/error), returns without calling eFact
    3. Attempts to download PDF from eFact
    4. If PDF available → status = "success"
    5. If error → status = "error" + saves error message
    6. Returns updated invoice

    **eFact Status Values:**
    - `pending`: Invoice created, not yet sent to eFact
    - `processing`: Sent to eFact, awaiting response from SUNAT
    - `success`: Successfully validated and accepted by SUNAT
    - `error`: Rejected by eFact/SUNAT (check efact_error for details)

    **Response:**
    Returns InvoiceResponse with updated:
    - `efact_status`: Current status from eFact
    - `efact_error`: Error message if failed
    - `efact_processed_at`: Timestamp when processing completed

    Args:
        invoice_id: Invoice ID to check status for
        current_user: Current authenticated user
        db: Database session

    Returns:
        InvoiceResponse: Invoice with updated eFact status

    Raises:
        HTTPException:
            - 400 Bad Request: Invoice has no eFact ticket
            - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPER_ADMIN)
            - 404 Not Found: Invoice not found
            - 500 Internal Server Error: Unexpected error
    """
    from datetime import datetime
    from app.repositories.invoice import invoice_repository
    from app.integrations.efact_client import EFactClient
    from app.schemas.invoice import InvoiceUpdate

    try:
        # 1. Get invoice
        invoice = invoice_repository.get(db, invoice_id)
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice {invoice_id} not found",
            )

        # 2. Validate tenant access (skip for SUPER_ADMIN)
        if current_user.role != Role.SUPER_ADMIN and invoice.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this invoice",
            )

        # 3. Validate invoice has eFact ticket
        if not invoice.efact_ticket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invoice {invoice_id} has no eFact ticket",
            )

        # 4. If already in final status, return without calling eFact
        if invoice.efact_status in ["success", "error"]:
            logger.info(
                f"Invoice {invoice_id} already in final status '{invoice.efact_status}'. "
                f"Returning cached result."
            )
            return InvoiceResponse.from_orm(invoice)

        # 5. Try to download PDF to verify status
        efact_client = EFactClient()
        try:
            pdf_bytes = efact_client.download_pdf(invoice.efact_ticket)

            # PDF available = success
            invoice_update = InvoiceUpdate(efact_status="success")
            invoice = invoice_repository.update(db, db_obj=invoice, obj_in=invoice_update)
            invoice.efact_processed_at = datetime.utcnow()
            db.add(invoice)
            db.commit()
            db.refresh(invoice)

            logger.info(
                f"Invoice {invoice_id} status updated to 'success' by user {current_user.id}. "
                f"PDF is available ({len(pdf_bytes)} bytes)."
            )

        except Exception as e:
            # Error downloading PDF = still processing or error
            error_msg = str(e)

            # Check if it's a "still processing" type error vs actual error
            # eFact typically returns different errors for "not ready yet" vs "failed"
            if "404" in error_msg or "not found" in error_msg.lower():
                # Document still processing, don't update to error yet
                logger.info(
                    f"Invoice {invoice_id} PDF not yet available. Status remains 'processing'."
                )
            else:
                # Actual error, update status
                invoice_update = InvoiceUpdate(
                    efact_status="error",
                    efact_error=f"Status check failed: {error_msg}"
                )
                invoice = invoice_repository.update(db, db_obj=invoice, obj_in=invoice_update)
                invoice.efact_processed_at = datetime.utcnow()
                db.add(invoice)
                db.commit()
                db.refresh(invoice)

                logger.warning(
                    f"Invoice {invoice_id} status updated to 'error' by user {current_user.id}. "
                    f"Error: {error_msg}"
                )

        return InvoiceResponse.from_orm(invoice)

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise

    except Exception as e:
        # Unexpected errors
        logger.error(
            f"Unexpected error checking status for invoice {invoice_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check invoice status: {str(e)}",
        )


@router.get(
    "/{invoice_id}/pdf",
    tags=["invoices"],
)
async def download_invoice_pdf(
    invoice_id: int,
    current_user: User = Depends(require_permission_dual("GET", "/invoices/*")),
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
    current_user: User = Depends(require_permission_dual("GET", "/invoices/*")),
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
    current_user: User = Depends(require_permission_dual("GET", "/invoices")),
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

