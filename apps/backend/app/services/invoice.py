"""
Invoice service - business logic for electronic invoice (comprobante) management.

This service orchestrates the complete flow of invoice creation, from validation
through eFact submission and status tracking.
"""

import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import Role
from app.integrations.efact_client import EFactClient, EFactError, generate_json_ubl
from app.models.invoice import Invoice
from app.models.invoice_serie import InvoiceSerie
from app.models.order import Order
from app.models.tenant import Tenant
from app.repositories.invoice import invoice_repository
from app.repositories.invoice_serie import invoice_serie_repository
from app.repositories.order import order_repository
from app.repositories.tenant import tenant_repository
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, InvoiceUpdate

logger = logging.getLogger(__name__)


class InvoiceService:
    """Service for managing electronic invoices (comprobantes electrónicos)."""

    def __init__(self):
        """Initialize the service with eFact client."""
        self.efact_client = EFactClient()

    def create_invoice(
        self,
        db: Session,
        order_id: int,
        tenant_id: Optional[int],
        invoice_data: InvoiceCreate,
        user_role: Role = Role.ADMIN,
    ) -> Invoice:
        """
        Create an electronic invoice from an order.

        This method handles the complete flow:
        1. Validates order exists, is validated, and has customer document
        2. Validates tenant has RUC configured
        3. Gets thread-safe correlativo from InvoiceSerie
        4. Calculates totals from line_items
        5. Handles references for NC/ND (Credit/Debit Notes)
        6. Creates Invoice record in database
        7. Generates JSON-UBL document
        8. Submits to eFact and updates with ticket
        9. Returns created Invoice

        Args:
            db: Database session
            order_id: Order ID to create invoice for
            tenant_id: Tenant ID (company). If None, SUPER_ADMIN will use order's tenant
            invoice_data: InvoiceCreate schema with invoice_type, serie, etc.
            user_role: Role of the user creating the invoice

        Returns:
            Invoice: Created invoice object with eFact ticket

        Raises:
            ValueError: If validation fails (order not found, no RUC, etc.)
            EFactError: If eFact submission fails
        """
        # ===== VALIDATION =====

        # Get order and validate it exists
        order = order_repository.get(db, order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")

        # For SUPER_ADMIN, use the order's tenant; otherwise use provided tenant_id
        if user_role == Role.SUPER_ADMIN:
            tenant_id = order.tenant_id
        
        # Validate order belongs to tenant (skip for SUPER_ADMIN)
        if user_role != Role.SUPER_ADMIN and order.tenant_id != tenant_id:
            raise ValueError(f"Order {order_id} does not belong to tenant {tenant_id}")

        # Validate order is validated (payment confirmed)
        if not order.validado:
            raise ValueError(f"Order {order_id} has not been validated yet")

        # Validate customer has document info
        if not order.customer_document_type or not order.customer_document_number:
            raise ValueError(
                f"Order {order_id} is missing customer document information "
                "(tipo_documento and numero_documento required)"
            )

        # Get tenant and validate it has RUC
        tenant = tenant_repository.get(db, tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        if not tenant.efact_ruc:
            raise ValueError(
                f"Tenant {tenant_id} ({tenant.name}) does not have RUC configured for electronic invoicing"
            )

        # ===== GET THREAD-SAFE CORRELATIVO =====

        # Get next correlativo (thread-safe with SELECT FOR UPDATE)
        # The repository method validates that serie exists and is active
        correlativo = invoice_serie_repository.get_next_correlative(
            db,
            tenant_id,
            invoice_data.serie,
        )

        # ===== CALCULATE TOTALS =====

        # Get line items from order
        line_items = order.line_items or []
        if not line_items:
            raise ValueError(f"Order {order_id} has no line items")

        # Calculate subtotal from line items
        subtotal = 0.0
        for item in line_items:
            # Each item should have price and quantity
            # Support both 'price' and 'unitPrice' keys for compatibility
            try:
                price = float(item.get("price") or item.get("unitPrice") or 0)
                quantity = float(item.get("quantity") or 0)
                subtotal += price * quantity
            except (ValueError, TypeError):
                raise ValueError(f"Invalid price or quantity in line items: {item}")

        # Calculate IGV (18% for Peru)
        igv = subtotal * 0.18
        total = subtotal + igv

        # ===== HANDLE REFERENCES FOR NC/ND =====

        reference_invoice = None
        reference_type = None
        reference_serie = None
        reference_correlativo = None

        # If this is a Credit Note (07) or Debit Note (08), need reference
        if invoice_data.invoice_type in ("07", "08"):
            if not invoice_data.reference_invoice_id:
                raise ValueError(
                    f"Reference invoice ID required for invoice type {invoice_data.invoice_type}"
                )

            reference_invoice = invoice_repository.get(
                db,
                invoice_data.reference_invoice_id,
            )
            if not reference_invoice:
                raise ValueError(
                    f"Referenced invoice {invoice_data.reference_invoice_id} not found"
                )

            if reference_invoice.tenant_id != tenant_id:
                raise ValueError(
                    f"Referenced invoice does not belong to tenant {tenant_id}"
                )

            reference_type = reference_invoice.invoice_type
            reference_serie = reference_invoice.serie
            reference_correlativo = reference_invoice.correlativo

        # ===== CREATE INVOICE RECORD =====

        invoice = Invoice(
            tenant_id=tenant_id,
            order_id=order_id,
            invoice_type=invoice_data.invoice_type,
            serie=invoice_data.serie,
            correlativo=correlativo,
            emisor_ruc=tenant.efact_ruc,
            emisor_razon_social=tenant.name,
            cliente_tipo_documento=order.customer_document_type,
            cliente_numero_documento=order.customer_document_number,
            cliente_razon_social=order.customer_name or "CLIENTE",
            currency=order.currency,
            subtotal=subtotal,
            igv=igv,
            total=total,
            items=line_items,
            reference_invoice_id=invoice_data.reference_invoice_id if invoice_data.reference_invoice_id else None,
            reference_type=reference_type,
            reference_serie=reference_serie,
            reference_correlativo=reference_correlativo,
            reference_reason=invoice_data.reference_reason,
            efact_status="pending",
        )

        # Save to database
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        # ===== GENERATE JSON-UBL =====

        try:
            json_ubl = generate_json_ubl(
                invoice_type=invoice.invoice_type,
                serie=invoice.serie,
                correlativo=invoice.correlativo,
                fecha_emision=datetime.utcnow(),
                emisor_ruc=invoice.emisor_ruc,
                emisor_razon_social=invoice.emisor_razon_social,
                cliente_tipo_doc=invoice.cliente_tipo_documento,
                cliente_numero_doc=invoice.cliente_numero_documento,
                cliente_razon_social=invoice.cliente_razon_social,
                currency=invoice.currency,
                items=[
                    {
                        "sku": item.get("sku", f"ITEM{idx+1:03d}"),
                        "description": item.get("product") or item.get("title", "Producto"),
                        "quantity": item.get("quantity", 1),
                        "unit_price": float(item.get("price") or item.get("unitPrice") or 0),
                        "unit": "NIU",
                    }
                    for idx, item in enumerate(invoice.items)
                ],
                subtotal=invoice.subtotal,
                igv=invoice.igv,
                total=invoice.total,
                reference_type=invoice.reference_type,
                reference_serie=invoice.reference_serie,
                reference_correlativo=invoice.reference_correlativo,
                reference_reason=invoice.reference_reason,
            )
        except Exception as e:
            logger.error(f"Failed to generate JSON-UBL for invoice {invoice.id}: {str(e)}")
            raise ValueError(f"Failed to generate JSON-UBL: {str(e)}")

        # ===== SUBMIT TO EFACT =====

        try:
            logger.info(
                f"Submitting invoice {invoice.id} to eFact with JSON-UBL: "
                f"Type={invoice.invoice_type}, "
                f"Serie={invoice.serie}, "
                f"Correlativo={invoice.correlativo}, "
                f"Emisor_RUC={invoice.emisor_ruc}, "
                f"Emisor={invoice.emisor_razon_social}, "
                f"Cliente_RUC={invoice.cliente_numero_documento}, "
                f"Total={invoice.total}"
            )
            
            efact_response = self.efact_client.send_document(json_ubl)
            efact_ticket = efact_response.get("description")

            if not efact_ticket:
                raise EFactError("No ticket returned from eFact submission")

            # Update invoice with eFact ticket and status
            invoice_update = InvoiceUpdate(
                efact_status="processing",
            )
            invoice = invoice_repository.update(
                db,
                db_obj=invoice,
                obj_in=invoice_update,
            )
            invoice.efact_ticket = efact_ticket
            invoice.efact_sent_at = datetime.utcnow()
            db.add(invoice)
            db.commit()

            logger.info(
                f"Invoice {invoice.id} submitted to eFact with ticket {efact_ticket}"
            )

        except EFactError as e:
            logger.error(f"eFact submission failed for invoice {invoice.id}: {str(e)}")
            # Update invoice with error status
            invoice_update = InvoiceUpdate(
                efact_status="error",
                efact_error=str(e),
            )
            invoice = invoice_repository.update(
                db,
                db_obj=invoice,
                obj_in=invoice_update,
            )
            raise ValueError(f"eFact submission failed: {str(e)}")

        return invoice

    def check_invoice_status(
        self,
        db: Session,
        invoice_id: int,
        tenant_id: Optional[int] = None,
    ) -> Invoice:
        """
        Check the status of an invoice in eFact and update the invoice record.

        Args:
            db: Database session
            invoice_id: Invoice ID
            tenant_id: Tenant ID (for verification). If None, skips tenant validation (SUPER_ADMIN)

        Returns:
            Invoice: Updated invoice object with latest eFact status

        Raises:
            ValueError: If invoice not found or doesn't belong to tenant
            EFactError: If status check fails
        """
        # Get invoice and validate
        invoice = invoice_repository.get(db, invoice_id)
        if not invoice:
            raise ValueError(f"Invoice {invoice_id} not found")

        # Validate tenant ownership if tenant_id is provided (non-SUPER_ADMIN)
        if tenant_id is not None and invoice.tenant_id != tenant_id:
            raise ValueError(f"Invoice {invoice_id} does not belong to tenant {tenant_id}")

        if not invoice.efact_ticket:
            raise ValueError(f"Invoice {invoice_id} has no eFact ticket")

        # Check status with eFact
        try:
            status_response = self.efact_client.get_document_status(invoice.efact_ticket)
            new_status = status_response.get("status", "error")

            # Update invoice based on response
            if new_status == "success":
                cdr = status_response.get("cdr")
                invoice_update = InvoiceUpdate(
                    efact_status="success",
                )
                invoice = invoice_repository.update(
                    db,
                    db_obj=invoice,
                    obj_in=invoice_update,
                )
                invoice.efact_response = cdr
                invoice.efact_processed_at = datetime.utcnow()

            elif new_status == "error":
                error_info = status_response.get("error", {})
                error_msg = error_info.get("message", "Unknown error")
                invoice_update = InvoiceUpdate(
                    efact_status="error",
                    efact_error=error_msg,
                )
                invoice = invoice_repository.update(
                    db,
                    db_obj=invoice,
                    obj_in=invoice_update,
                )
                invoice.efact_processed_at = datetime.utcnow()

            # Status "processing" doesn't need update, just return current state

            db.add(invoice)
            db.commit()

            logger.info(
                f"Invoice {invoice.id} status updated to {new_status}"
            )

        except EFactError as e:
            logger.error(f"Failed to check eFact status for invoice {invoice_id}: {str(e)}")
            raise ValueError(f"Failed to check eFact status: {str(e)}")

        return invoice

    def get_invoices_by_order(
        self,
        db: Session,
        order_id: int,
        tenant_id: int,
    ) -> list[Invoice]:
        """
        Get all invoices for a specific order.

        Args:
            db: Database session
            order_id: Order ID
            tenant_id: Tenant ID (for verification)

        Returns:
            List of invoices for the order

        Raises:
            ValueError: If order not found or doesn't belong to tenant
        """
        # Validate order belongs to tenant
        order = order_repository.get(db, order_id)
        if not order:
            raise ValueError(f"Order {order_id} not found")

        if order.tenant_id != tenant_id:
            raise ValueError(f"Order {order_id} does not belong to tenant {tenant_id}")

        return invoice_repository.get_by_order(db, order_id)

    def get_invoices_by_tenant(
        self,
        db: Session,
        tenant_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Invoice], int]:
        """
        Get paginated invoices for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID. If None, returns invoices from all tenants (for SUPER_ADMIN)
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            Tuple of (invoices list, total count)
        """
        # SUPER_ADMIN: get all invoices from all tenants
        if tenant_id is None:
            invoices = invoice_repository.get_all(db, skip=skip, limit=limit)
            total = invoice_repository.count_all(db)
        # Regular users: get invoices from their tenant
        else:
            invoices = invoice_repository.get_by_tenant(db, tenant_id, skip=skip, limit=limit)
            total = invoice_repository.count_by_tenant(db, tenant_id)
        
        return invoices, total


# Singleton instance
invoice_service = InvoiceService()
