"""
Invoice repository.
"""

from typing import Optional

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
    ) -> list[Invoice]:
        """
        Get all invoices from all tenants with pagination (for SUPER_ADMIN).

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of invoices ordered by created_at DESC
        """
        return (
            db.query(Invoice)
            .order_by(Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_by_tenant(
        self,
        db: Session,
        tenant_id: int,
    ) -> int:
        """
        Count total number of invoices for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            Total count of invoices
        """
        return db.query(Invoice).filter(Invoice.tenant_id == tenant_id).count()

    def count_all(
        self,
        db: Session,
    ) -> int:
        """
        Count total number of invoices from all tenants (for SUPER_ADMIN).

        Args:
            db: Database session

        Returns:
            Total count of invoices
        """
        return db.query(Invoice).count()

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
