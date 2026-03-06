"""
Invoice (comprobante electrónico) endpoints.

Endpoints for managing electronic invoices (facturas, boletas, NC, ND)
integrated with SUNAT via eFact-OSE API.

NOTE: Invoice creation and listing by order are now under /orders/{order_id}/invoices
See: apps/backend/app/api/v1/endpoints/orders.py
"""

import asyncio
import logging
from datetime import date

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import (
    get_database,
    require_permission_dual,
)
from app.core.permissions import Role
from app.core.timezone import get_date_range_utc
from app.integrations.efact_client import efact_client
from app.models.tenant import Tenant
from app.models.user import User
from app.repositories.invoice import invoice_repository
from app.repositories.tenant import tenant_repository
from app.schemas.invoice import (
    BulkDownloadRequest,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceSendEmailRequest,
    InvoiceSendEmailResponse,
)
from app.services.email_service import EmailError, email_service
from app.services.export_service import export_service
from app.services.invoice import invoice_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# IMPORTANT: Static path endpoints (/export, /bulk-download) MUST be defined
# BEFORE dynamic path endpoints (/{invoice_id}/*) to avoid FastAPI route shadowing.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get("/export", tags=["invoices"])
async def export_invoices(
    format: str = Query("csv", pattern="^(csv|excel)$", description="Export format"),
    start_date: date | None = Query(None, description="Start date (YYYY-MM-DD, tenant timezone)"),
    end_date: date | None = Query(None, description="End date (YYYY-MM-DD, tenant timezone)"),
    tenant_id: int | None = Query(None, description="Tenant ID (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/invoices")),
    db: Session = Depends(get_database),
) -> Response:
    """
    Export invoices as CSV or Excel file.

    Exports all invoices matching the filters. Dates are converted from
    tenant timezone to UTC for querying. Max 10,000 records.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).
    """
    try:
        # Determine effective tenant_id
        if current_user.role == Role.SUPERADMIN:
            effective_tenant_id = tenant_id
        else:
            effective_tenant_id = current_user.tenant_id

        # Get tenant timezone
        tz_tenant_id = effective_tenant_id or current_user.tenant_id
        tenant = db.query(Tenant.timezone).filter(Tenant.id == tz_tenant_id).first()
        tz_name = tenant[0] if tenant and tenant[0] else "America/Lima"

        # Convert dates to UTC
        start_utc = end_utc = None
        if start_date and end_date:
            start_utc, end_utc = get_date_range_utc(start_date, end_date, tz_name)

        if effective_tenant_id is not None:
            invoices = invoice_repository.get_by_tenant(
                db, effective_tenant_id, skip=0, limit=10000,
                start_date=start_utc, end_date=end_utc,
            )
        else:
            invoices = invoice_repository.get_all(
                db, skip=0, limit=10000,
                start_date=start_utc, end_date=end_utc,
            )

        if format == "excel":
            output = export_service.export_invoices_excel(invoices, tz_name)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "comprobantes.xlsx"
        else:
            output = export_service.export_invoices_csv(invoices, tz_name)
            media_type = "text/csv"
            filename = "comprobantes.csv"

        logger.info(
            f"Exported {len(invoices)} invoices as {format} by user {current_user.id}"
        )

        return Response(
            content=output.read(),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except Exception as e:
        logger.error(f"Error exporting invoices: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export invoices: {str(e)}",
        )


@router.post("/bulk-download", tags=["invoices"])
async def bulk_download_invoices(
    request_data: BulkDownloadRequest,
    current_user: User = Depends(require_permission_dual("POST", "/invoices/bulk-download")),
    db: Session = Depends(get_database),
) -> Response:
    """
    Download multiple invoice files (PDF, XML, or CDR) as a ZIP archive.

    The user selects which file type they want. Only invoices with
    efact_status='success' can be downloaded.

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    Args:
        request_data: Invoice IDs and file type to download
        current_user: Current authenticated user
        db: Database session

    Returns:
        Response: ZIP file containing the requested files
    """
    import io
    import json
    import zipfile

    from app.integrations.efact_client import EFactClient

    try:
        # Validate all invoices exist and belong to tenant
        invoices = []
        for inv_id in request_data.invoice_ids:
            invoice = invoice_repository.get(db, inv_id)
            if not invoice:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Invoice {inv_id} not found",
                )
            if current_user.role != Role.SUPERADMIN and invoice.tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied to invoice {inv_id}",
                )
            if invoice.efact_status != "success":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invoice {inv_id} is not validated (status: {invoice.efact_status})",
                )
            invoices.append(invoice)

        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        efact = EFactClient()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for invoice in invoices:
                full_number = f"{invoice.serie}-{invoice.correlativo:08d}"

                if request_data.file_type == "pdf":
                    content = efact.download_pdf(invoice.efact_ticket)
                    zf.writestr(f"{full_number}.pdf", content)

                elif request_data.file_type == "xml":
                    content = efact.download_xml(invoice.efact_ticket)
                    zf.writestr(f"{full_number}.xml", content)

                elif request_data.file_type == "cdr":
                    if invoice.efact_response:
                        cdr_json = json.dumps(invoice.efact_response, indent=2, ensure_ascii=False)
                        zf.writestr(f"{full_number}-CDR.json", cdr_json)

        zip_buffer.seek(0)
        filename = f"comprobantes-{request_data.file_type}.zip"

        logger.info(
            f"Bulk download: {len(invoices)} {request_data.file_type} files "
            f"by user {current_user.id}"
        )

        return Response(
            content=zip_buffer.read(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Error in bulk download: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create bulk download: {str(e)}",
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Dynamic path endpoints (/{invoice_id}/*) below this line
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@router.get(
    "/{invoice_id}/cdr",
    tags=["invoices"],
)
async def download_invoice_cdr(
    invoice_id: int,
    current_user: User = Depends(require_permission_dual("GET", "/invoices/*")),
    db: Session = Depends(get_database),
) -> Response:
    """
    Download the CDR (Constancia de Recepción) of an invoice.

    The CDR is SUNAT's response stored in invoice.efact_response after
    successful processing. Returned as a JSON file.

    **Permissions:**
    - All authenticated users can download CDRs of their tenant's invoices
    - SUPERADMIN can download CDRs of any tenant's invoices

    Args:
        invoice_id: Invoice ID to download CDR for
        current_user: Current authenticated user
        db: Database session

    Returns:
        Response: JSON file with CDR data
    """
    import json

    try:
        invoice = invoice_repository.get(db, invoice_id)

        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice {invoice_id} not found",
            )

        if current_user.role != Role.SUPERADMIN and invoice.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this invoice",
            )

        if invoice.efact_status != "success":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"CDR not available. Invoice status is '{invoice.efact_status}', must be 'success'.",
            )

        if not invoice.efact_response:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CDR not available. Invoice has no eFact response stored.",
            )

        cdr_json = json.dumps(invoice.efact_response, indent=2, ensure_ascii=False)
        filename = f"{invoice.serie}-{invoice.correlativo:08d}-CDR.json"

        logger.info(
            f"CDR downloaded for invoice {invoice_id} by user {current_user.id}. "
            f"Filename: {filename}"
        )

        return Response(
            content=cdr_json.encode("utf-8"),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            },
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(
            f"Unexpected error downloading CDR for invoice {invoice_id}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download CDR: {str(e)}",
        )


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
    - SUPERADMIN can check status of any tenant's invoices

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
            - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPERADMIN)
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

        # 2. Validate tenant access (skip for SUPERADMIN)
        if current_user.role != Role.SUPERADMIN and invoice.tenant_id != current_user.tenant_id:
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
    - SUPERADMIN can download PDFs of any tenant's invoices

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
            - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPERADMIN)
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

        # Validate tenant access (skip for SUPERADMIN)
        if current_user.role != Role.SUPERADMIN and invoice.tenant_id != current_user.tenant_id:
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
    - SUPERADMIN can download XMLs of any tenant's invoices

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
            - 403 Forbidden: Invoice doesn't belong to user's tenant (non-SUPERADMIN)
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

        # Validate tenant access (skip for SUPERADMIN)
        if current_user.role != Role.SUPERADMIN and invoice.tenant_id != current_user.tenant_id:
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
    "",
    response_model=InvoiceListResponse,
    tags=["invoices"],
)
async def list_invoices(
    skip: int = 0,
    limit: int = 100,
    tenant_id: int | None = None,
    current_user: User = Depends(require_permission_dual("GET", "/invoices")),
    db: Session = Depends(get_database),
) -> InvoiceListResponse:
    """
    List all invoices with pagination.

    Returns paginated list of electronic invoices,
    ordered by creation date (most recent first).

    **Permissions:** 
    - All authenticated users can view their tenant's invoices
    - SUPERADMIN can view invoices from all tenants

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
        # SUPERADMIN can view invoices from all tenants or filter by tenant_id
        # Other users can only view their tenant's invoices (tenant_id param ignored)
        if current_user.role == Role.SUPERADMIN:
            tenant_id = tenant_id  # Use provided filter or None for all
        else:
            tenant_id = current_user.tenant_id
        
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
            f"{'all tenants' if current_user.role == Role.SUPERADMIN else f'tenant {current_user.tenant_id}'}: "
            f"{str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve invoices: {str(e)}",
        )


@router.post(
    "/{invoice_id}/send-email",
    response_model=InvoiceSendEmailResponse,
    summary="Send invoice by email",
    description="Send invoice PDF to customer via email using Resend",
    tags=["invoices"],
)
async def send_invoice_email(
    invoice_id: int,
    request_data: InvoiceSendEmailRequest = Body(default=InvoiceSendEmailRequest()),
    current_user: User = Depends(require_permission_dual("POST", "/invoices/*")),
    db: Session = Depends(get_database),
) -> InvoiceSendEmailResponse:
    """
    Send invoice by email to customer.

    **Requirements:**
    - Invoice must exist and belong to user's tenant
    - Invoice must have efact_status = "success" (validated by SUNAT)
    - Email address must be provided (in request or invoice.cliente_email)

    **Process:**
    1. Validate invoice exists and is successful
    2. Determine recipient email
    3. Download PDF from eFact
    4. Optionally download XML
    5. Send email via Resend
    6. Return success response

    **Authentication:** Accepts JWT token OR API key (X-API-Key header).

    Args:
        invoice_id: ID of the invoice to send
        request_data: Email request with optional recipient_email and include_xml
        current_user: Current authenticated user
        db: Database session

    Returns:
        InvoiceSendEmailResponse: Success status with email_id and sent_to address

    Raises:
        HTTPException:
            - 404 Not Found: Invoice doesn't exist
            - 403 Forbidden: User doesn't have access to this invoice
            - 400 Bad Request: Invoice not successful, no email provided, or invalid email
            - 500 Internal Server Error: PDF download or email sending failed
    """
    # Get invoice and validate access
    invoice = invoice_repository.get(db, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )

    # Check tenant access (unless SUPERADMIN)
    if current_user.role != Role.SUPERADMIN and invoice.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate invoice is successful (SUNAT accepted)
    if invoice.efact_status != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send email for invoice with status '{invoice.efact_status}'. "
                   "Invoice must be successfully validated by SUNAT."
        )

    # Determine recipient email
    recipient_email = request_data.recipient_email or invoice.cliente_email

    if not recipient_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email address provided. Please provide recipient_email or ensure "
                   "invoice has cliente_email set."
        )

    # Validate email format
    try:
        validated = validate_email(recipient_email)
        recipient_email = validated.email
    except EmailNotValidError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid email address: {str(e)}"
        )

    # Get tenant info
    tenant = tenant_repository.get(db, invoice.tenant_id)

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tenant not found"
        )

    # Download PDF from eFact

    try:
        pdf_bytes = efact_client.download_pdf(invoice.efact_ticket)
    except Exception as e:
        logger.error(f"Failed to download PDF for invoice {invoice_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download PDF from eFact: {str(e)}"
        )

    # Download XML if requested
    xml_bytes = None
    if request_data.include_xml:
        try:
            xml_bytes = efact_client.download_xml(invoice.efact_ticket)
        except Exception as e:
            # XML download failure is not critical, log but continue
            logger.warning(f"Failed to download XML for invoice {invoice_id}: {str(e)}")

    # Send email
    try:
        resend_response = await email_service.send_invoice_email(
            to_email=recipient_email,
            invoice=invoice,
            pdf_bytes=pdf_bytes,
            tenant=tenant,
            include_xml=request_data.include_xml,
            xml_bytes=xml_bytes,
        )

        # Extract email ID from Resend response
        email_id = resend_response.get("id")

        logger.info(
            f"Invoice {invoice_id} sent via email to {recipient_email} "
            f"by user {current_user.id} (email_id: {email_id})"
        )

        return InvoiceSendEmailResponse(
            success=True,
            email_id=email_id,
            sent_to=recipient_email,
            message=f"Invoice sent successfully to {recipient_email}"
        )

    except EmailError as e:
        logger.error(f"Failed to send email for invoice {invoice_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )

