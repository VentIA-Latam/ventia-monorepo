"""
InvoiceSerie repository with thread-safe correlative generation.
"""

from sqlalchemy.orm import Session

from app.models.invoice_serie import InvoiceSerie
from app.repositories.base import CRUDBase
from app.schemas.invoice import InvoiceSerieCreate, InvoiceSerieUpdate


class InvoiceSerieRepository(CRUDBase[InvoiceSerie, InvoiceSerieCreate, InvoiceSerieUpdate]):
    """Repository for InvoiceSerie model with thread-safe operations."""

    def get_by_serie(
        self,
        db: Session,
        tenant_id: int,
        serie: str,
    ) -> InvoiceSerie | None:
        """
        Get a specific invoice serie by tenant and serie code.

        Args:
            db: Database session
            tenant_id: Tenant ID
            serie: Serie code (e.g., "F001", "B001")

        Returns:
            InvoiceSerie or None if not found
        """
        return (
            db.query(InvoiceSerie)
            .filter(
                InvoiceSerie.tenant_id == tenant_id,
                InvoiceSerie.serie == serie,
            )
            .first()
        )

    def get_active_by_type(
        self,
        db: Session,
        tenant_id: int,
        invoice_type: str,
    ) -> list[InvoiceSerie]:
        """
        Get all active invoice series for a tenant by invoice type.

        Args:
            db: Database session
            tenant_id: Tenant ID
            invoice_type: Invoice type (01, 03, 07, 08)

        Returns:
            List of active invoice series
        """
        return (
            db.query(InvoiceSerie)
            .filter(
                InvoiceSerie.tenant_id == tenant_id,
                InvoiceSerie.invoice_type == invoice_type,
                InvoiceSerie.is_active == True,
            )
            .order_by(InvoiceSerie.serie)
            .all()
        )

    def get_next_correlative(
        self,
        db: Session,
        tenant_id: int,
        serie: str,
    ) -> int:
        """
        Get next correlative number for an invoice serie (THREAD-SAFE).

        This method uses SELECT FOR UPDATE to ensure that concurrent requests
        do not get the same correlative number. The row is locked until the
        transaction is committed.

        **Thread-Safety:**
        - Uses pessimistic locking with `with_for_update()`
        - Prevents race conditions in high-concurrency scenarios
        - Automatically releases lock after commit

        **Process:**
        1. Lock the series row with SELECT FOR UPDATE
        2. Increment last_correlativo by 1
        3. Commit immediately
        4. Return the new correlativo

        Args:
            db: Database session
            tenant_id: Tenant ID
            serie: Serie code (e.g., "F001", "B001")

        Returns:
            Next correlativo number

        Raises:
            ValueError: If serie does not exist or is not active
        """
        # SELECT FOR UPDATE - Pessimistic lock
        serie_obj = (
            db.query(InvoiceSerie)
            .filter(
                InvoiceSerie.tenant_id == tenant_id,
                InvoiceSerie.serie == serie,
            )
            .with_for_update()  # CRITICAL: Locks the row until commit
            .first()
        )

        # Validate serie exists
        if not serie_obj:
            raise ValueError(
                f"Serie '{serie}' does not exist for tenant {tenant_id}"
            )

        # Validate serie is active
        if not serie_obj.is_active:
            raise ValueError(
                f"Serie '{serie}' is inactive and cannot be used"
            )

        # Increment correlativo
        serie_obj.last_correlativo += 1
        new_correlativo = serie_obj.last_correlativo

        # Commit immediately to release lock
        db.commit()
        db.refresh(serie_obj)

        return new_correlativo

    def get_by_tenant(
        self,
        db: Session,
        tenant_id: int,
    ) -> list[InvoiceSerie]:
        """
        Get all invoice series for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            List of all invoice series for the tenant
        """
        return (
            db.query(InvoiceSerie)
            .filter(InvoiceSerie.tenant_id == tenant_id)
            .order_by(InvoiceSerie.invoice_type, InvoiceSerie.serie)
            .all()
        )

    def get_all(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        tenant_id: int | None = None,
    ) -> list[InvoiceSerie]:
        """
        Get all invoice series from all tenants (for SUPER_ADMIN).

        Args:
            db: Database session
            skip: Number to skip
            limit: Max results
            tenant_id: Optional filter by tenant ID

        Returns:
            List of invoice series
        """
        query = db.query(InvoiceSerie)

        # Optional tenant filter (for SUPER_ADMIN with specific tenant)
        if tenant_id is not None:
            query = query.filter(InvoiceSerie.tenant_id == tenant_id)

        return (
            query
            .order_by(InvoiceSerie.tenant_id, InvoiceSerie.invoice_type, InvoiceSerie.serie)
            .offset(skip)
            .limit(limit)
            .all()
        )


# Global repository instance
invoice_serie_repository = InvoiceSerieRepository(InvoiceSerie)
