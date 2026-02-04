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
            tenant_id: Tenant ID (company). If None, SUPERADMIN will use order's tenant
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
        if user_role == Role.SUPERADMIN:
            tenant_id = order.tenant_id
        
        # Validate order belongs to tenant (skip for SUPER_ADMIN)
        if user_role != Role.SUPERADMIN and order.tenant_id != tenant_id:
            raise ValueError(f"Order {order_id} does not belong to tenant {tenant_id}")

        # Validate order is validated (payment confirmed)
        if not order.validado:
            raise ValueError(f"Order {order_id} has not been validated yet")

        # ===== DETERMINE CUSTOMER DATA =====
        # Use provided customer data if available, otherwise use order data
        
        # Determine customer document type
        if invoice_data.cliente_tipo_documento:
            customer_document_type = invoice_data.cliente_tipo_documento
        else:
            customer_document_type = order.customer_document_type
        
        # Determine customer document number
        if invoice_data.cliente_numero_documento:
            customer_document_number = invoice_data.cliente_numero_documento
        else:
            customer_document_number = order.customer_document_number
        
        # Determine customer name/razon social
        if invoice_data.cliente_razon_social:
            customer_razon_social = invoice_data.cliente_razon_social
        else:
            customer_razon_social = order.customer_name or "CLIENTE"
        
        # Determine customer email
        if invoice_data.cliente_email:
            customer_email = invoice_data.cliente_email
        else:
            customer_email = order.customer_email

        # Validate customer has document info
        if not customer_document_type or not customer_document_number:
            raise ValueError(
                f"Customer document information is required for invoicing. "
                "Provide cliente_tipo_documento and cliente_numero_documento in the request, "
                "or ensure the order has customer_document_type and customer_document_number."
            )

        # ===== VALIDATE DOCUMENT TYPE VS INVOICE TYPE =====
        # SUNAT document types (catálogo 06):
        # - 0: Sin documento (for customers without identification)
        # - 1: DNI (Documento Nacional de Identidad)
        # - 4: Carnet de extranjería
        # - 6: RUC (Registro Único de Contribuyentes)
        # - 7: Pasaporte
        # - A: Cédula diplomática de identidad
        
        # SUNAT rules for invoice types:
        # - Factura (01): MUST have RUC (tipo_documento = "6") with 11 digits
        # - Boleta (03): Can have DNI, Sin documento, Carnet extranjería, Pasaporte, etc.
        # - NC/ND (07/08): Follow same rules as the referenced document
        
        # Define valid document types per invoice type
        VALID_DOCUMENT_TYPES_FACTURA = ["6"]  # Only RUC for Facturas
        VALID_DOCUMENT_TYPES_BOLETA = ["0", "1", "4", "6", "7", "A"]  # Multiple types for Boletas
        
        # Validate based on invoice type
        if invoice_data.invoice_type == "01":  # Factura
            if customer_document_type not in VALID_DOCUMENT_TYPES_FACTURA:
                raise ValueError(
                    "Facturas (invoice_type=01) require RUC (cliente_tipo_documento=6) with 11 digits. "
                    f"Received cliente_tipo_documento={customer_document_type}. "
                    "For customers without RUC, use Boleta (invoice_type=03) instead."
                )
            # Factura must have RUC with exactly 11 digits
            if len(customer_document_number) != 11:
                raise ValueError(
                    f"Facturas require RUC with 11 digits. "
                    f"Received: {customer_document_number} ({len(customer_document_number)} digits)."
                )
        
        elif invoice_data.invoice_type == "03":  # Boleta
            if customer_document_type not in VALID_DOCUMENT_TYPES_BOLETA:
                raise ValueError(
                    f"Invalid cliente_tipo_documento for Boleta: {customer_document_type}. "
                    f"Valid types: 0 (Sin documento), 1 (DNI), 4 (Carnet extranjería), "
                    f"6 (RUC), 7 (Pasaporte), A (Cédula diplomática)."
                )
            
            # Validate document number length based on type
            if customer_document_type == "1":  # DNI
                if len(customer_document_number) != 8:
                    raise ValueError(
                        f"DNI (tipo_documento=1) must be 8 digits. "
                        f"Received: {customer_document_number} ({len(customer_document_number)} digits)."
                    )
            elif customer_document_type == "6":  # RUC
                if len(customer_document_number) != 11:
                    raise ValueError(
                        f"RUC (tipo_documento=6) must be 11 digits. "
                        f"Received: {customer_document_number} ({len(customer_document_number)} digits)."
                    )
            elif customer_document_type == "4":  # Carnet de extranjería
                if len(customer_document_number) < 8 or len(customer_document_number) > 12:
                    raise ValueError(
                        f"Carnet de extranjería (tipo_documento=4) must be between 8 and 12 characters. "
                        f"Received: {customer_document_number} ({len(customer_document_number)} characters)."
                    )
            elif customer_document_type == "7":  # Pasaporte
                if len(customer_document_number) < 5 or len(customer_document_number) > 12:
                    raise ValueError(
                        f"Pasaporte (tipo_documento=7) must be between 5 and 12 characters. "
                        f"Received: {customer_document_number} ({len(customer_document_number)} characters)."
                    )
            elif customer_document_type == "0":  # Sin documento
                # For "sin documento", allow flexible length but minimum 1 character
                if len(customer_document_number) < 1:
                    raise ValueError(
                        "Document number is required even for tipo_documento=0 (Sin documento). "
                        "Use a placeholder value like '00000000'."
                    )
            # tipo_documento "A" (Cédula diplomática) - flexible length
        
        # For NC/ND (07/08), validate against all possible types since they reference other invoices
        elif invoice_data.invoice_type in ("07", "08"):
            all_valid_types = set(VALID_DOCUMENT_TYPES_FACTURA + VALID_DOCUMENT_TYPES_BOLETA)
            if customer_document_type not in all_valid_types:
                raise ValueError(
                    f"Invalid cliente_tipo_documento: {customer_document_type}. "
                    f"Valid types: {', '.join(sorted(all_valid_types))}."
                )
            
            # Validate lengths for common types
            if customer_document_type == "1" and len(customer_document_number) != 8:
                raise ValueError(f"DNI must be 8 digits. Received: {len(customer_document_number)} digits.")
            elif customer_document_type == "6" and len(customer_document_number) != 11:
                raise ValueError(f"RUC must be 11 digits. Received: {len(customer_document_number)} digits.")

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

        # IMPORTANT: Prices in line_items ALREADY INCLUDE IGV (final consumer prices)
        # We need to calculate the base amount (subtotal) by removing IGV
        #
        # Formula: total = subtotal + igv = subtotal + (subtotal * 0.18) = subtotal * 1.18
        # Therefore: subtotal = total / 1.18

        # Use order.total_price as the final amount (already includes IGV)
        total = order.total_price

        # Calculate base amount (subtotal without IGV)
        subtotal = round(total / 1.18, 2)

        # Calculate IGV as the difference
        igv = round(total - subtotal, 2)

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
            cliente_tipo_documento=customer_document_type,
            cliente_numero_documento=customer_document_number,
            cliente_razon_social=customer_razon_social,
            cliente_email=customer_email,
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
                        # IMPORTANT: Prices in line_items include IGV, but generate_json_ubl
                        # expects prices WITHOUT IGV (it calculates IGV internally)
                        "unit_price": round(
                            float(item.get("price") or item.get("unitPrice") or 0) / 1.18, 2
                        ),
                        "unit": "NIU",
                    }
                    for idx, item in enumerate(invoice.items)
                ],
                subtotal=invoice.subtotal,
                igv=invoice.igv,
                total=invoice.total,
                # Datos del emisor desde el tenant
                emisor_nombre_comercial=tenant.emisor_nombre_comercial,
                emisor_ubigeo=tenant.emisor_ubigeo,
                emisor_departamento=tenant.emisor_departamento,
                emisor_provincia=tenant.emisor_provincia,
                emisor_distrito=tenant.emisor_distrito,
                emisor_direccion=tenant.emisor_direccion or "SIN DIRECCION",
                # Referencias para NC/ND
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
            tenant_id: Tenant ID (for verification). If None, skips tenant validation (SUPERADMIN)

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

        # Validate tenant ownership if tenant_id is provided (non-SUPERADMIN)
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
            tenant_id: Tenant ID. If None, returns invoices from all tenants (for SUPERADMIN)
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            Tuple of (invoices list, total count)
        """
        # SUPERADMIN: get all invoices from all tenants
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
