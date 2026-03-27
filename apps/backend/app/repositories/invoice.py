"""
Invoice repository.
"""

from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.repositories.base import CRUDBase
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate


class InvoiceRepository(CRUDBase[Invoice, InvoiceCreate, InvoiceUpdate]):
    """Repository for Invoice model."""

    def get_by_order(
        self,
        db: Session,
        order_id: int,
    ) -> list[Invoice]:
        """
        Get all invoices for a specific order.

        Args:
            db: Database session
            order_id: Order ID

        Returns:
            List of invoices for the order
        """
        return (
            db.query(Invoice)
            .filter(Invoice.order_id == order_id)
            .order_by(Invoice.created_at.desc())
            .all()
        )

    def get_by_tenant(
        self,
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Invoice]:
        """
        Get all invoices for a specific tenant with pagination.

        Args:
            db: Database session
            tenant_id: Tenant ID
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of invoices ordered by created_at DESC
        """
        return (
            db.query(Invoice)
            .filter(Invoice.tenant_id == tenant_id)
            .order_by(Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_all(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        tenant_id: int | None = None,
        search: str | None = None,
        invoice_type: str | None = None,
        efact_status: str | None = None,
    ) -> list[Invoice]:
        """Get all invoices with optional filters and pagination."""
        query = db.query(Invoice)
        if tenant_id is not None:
            query = query.filter(Invoice.tenant_id == tenant_id)
        if search:
            pattern = f"%{search}%"
            conditions = [
                Invoice.serie.ilike(pattern),
                Invoice.cliente_razon_social.ilike(pattern),
                Invoice.cliente_numero_documento.ilike(pattern),
            ]
            if search.isdigit():
                conditions.append(Invoice.correlativo == int(search))
            query = query.filter(or_(*conditions))
        if invoice_type:
            query = query.filter(Invoice.invoice_type == invoice_type)
        if efact_status:
            query = query.filter(Invoice.efact_status == efact_status)
        return query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()

    def count_all(
        self,
        db: Session,
        *,
        tenant_id: int | None = None,
        search: str | None = None,
        invoice_type: str | None = None,
        efact_status: str | None = None,
    ) -> int:
        """Count invoices with same filters as get_all."""
        query = db.query(Invoice)
        if tenant_id is not None:
            query = query.filter(Invoice.tenant_id == tenant_id)
        if search:
            pattern = f"%{search}%"
            conditions = [
                Invoice.serie.ilike(pattern),
                Invoice.cliente_razon_social.ilike(pattern),
                Invoice.cliente_numero_documento.ilike(pattern),
            ]
            if search.isdigit():
                conditions.append(Invoice.correlativo == int(search))
            query = query.filter(or_(*conditions))
        if invoice_type:
            query = query.filter(Invoice.invoice_type == invoice_type)
        if efact_status:
            query = query.filter(Invoice.efact_status == efact_status)
        return query.count()

    def get_by_ticket(
        self,
        db: Session,
        ticket: str,
    ) -> Invoice | None:
        """
        Get invoice by eFact ticket.

        Args:
            db: Database session
            ticket: eFact ticket UUID

        Returns:
            Invoice or None if not found
        """
        return db.query(Invoice).filter(Invoice.efact_ticket == ticket).first()

    def get_pending_processing(
        self,
        db: Session,
        tenant_id: Optional[int] = None,
        *,
        limit: int = 100,
    ) -> list[Invoice]:
        """
        Get invoices with status 'pending' or 'processing' for polling.

        This method is useful for background tasks that need to check
        the status of invoices that are still being processed by eFact.

        Args:
            db: Database session
            tenant_id: Optional tenant ID to filter by
            limit: Maximum number of records to return

        Returns:
            List of invoices with pending or processing status
        """
        query = db.query(Invoice).filter(
            Invoice.efact_status.in_(["pending", "processing"])
        )

        if tenant_id is not None:
            query = query.filter(Invoice.tenant_id == tenant_id)

        return query.order_by(Invoice.created_at.desc()).limit(limit).all()


# Global repository instance
invoice_repository = InvoiceRepository(Invoice)
