"""
InvoiceSerie service - business logic for invoice series management.

This service manages the creation and configuration of invoice series (series)
that are used to organize and generate invoice numbers.
"""

import logging

from sqlalchemy.orm import Session

from app.models.invoice_serie import InvoiceSerie
from app.repositories.invoice_serie import invoice_serie_repository
from app.repositories.tenant import tenant_repository
from app.schemas.invoice import InvoiceSerieCreate, InvoiceSerieUpdate

logger = logging.getLogger(__name__)


class InvoiceSerieService:
    """Service for managing invoice series (series for invoice numbers)."""

    def create_serie(
        self,
        db: Session,
        tenant_id: int,
        serie_data: InvoiceSerieCreate,
    ) -> InvoiceSerie:
        """
        Create a new invoice serie for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID (company)
            serie_data: InvoiceSerieCreate schema

        Returns:
            InvoiceSerie: Created serie object

        Raises:
            ValueError: If validation fails (serie already exists, tenant not found, etc.)
        """
        # Validate tenant exists
        tenant = tenant_repository.get(db, tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        # Check if serie already exists for this tenant
        existing_serie = invoice_serie_repository.get_by_serie(
            db,
            tenant_id,
            serie_data.serie,
        )
        if existing_serie:
            raise ValueError(
                f"Invoice serie {serie_data.serie} already exists for tenant {tenant_id}"
            )

        # Validate serie format (should be 4 characters)
        if len(serie_data.serie) != 4:
            raise ValueError(f"Serie must be exactly 4 characters long (received '{serie_data.serie}')")

        # Validate invoice type is valid
        valid_types = ("01", "03", "07", "08")
        if serie_data.invoice_type not in valid_types:
            raise ValueError(
                f"Invalid invoice_type '{serie_data.invoice_type}'. Must be one of: {valid_types}"
            )

        # Create serie using repository
        serie = invoice_serie_repository.create(
            db,
            obj_in=serie_data,
            tenant_id=tenant_id,
        )
        db.commit()

        logger.info(
            f"Created invoice serie {serie.serie} (type {serie.invoice_type}) "
            f"for tenant {tenant_id}"
        )

        return serie

    def get_serie_by_tenant_and_code(
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
        return invoice_serie_repository.get_by_serie(db, tenant_id, serie)

    def get_series_by_tenant(
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
            List of InvoiceSerie objects ordered by invoice_type and serie
        """
        # Validate tenant exists
        tenant = tenant_repository.get(db, tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        return invoice_serie_repository.get_by_tenant(db, tenant_id)

    def get_active_series_by_type(
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
            invoice_type: Invoice type (01=Factura, 03=Boleta, 07=NC, 08=ND)

        Returns:
            List of active InvoiceSerie objects

        Raises:
            ValueError: If tenant not found
        """
        # Validate tenant exists
        tenant = tenant_repository.get(db, tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        return invoice_serie_repository.get_active_by_type(
            db,
            tenant_id,
            invoice_type,
        )

    def update_serie(
        self,
        db: Session,
        serie_id: int,
        tenant_id: int,
        serie_data: InvoiceSerieUpdate,
    ) -> InvoiceSerie:
        """
        Update an invoice serie.

        Args:
            db: Database session
            serie_id: Serie ID
            tenant_id: Tenant ID (for verification)
            serie_data: InvoiceSerieUpdate schema

        Returns:
            InvoiceSerie: Updated serie object

        Raises:
            ValueError: If serie not found or doesn't belong to tenant
        """
        # Get serie and validate
        serie = invoice_serie_repository.get(db, serie_id)
        if not serie:
            raise ValueError(f"Invoice serie {serie_id} not found")

        # Verify serie belongs to tenant
        if serie.tenant_id != tenant_id:
            raise ValueError(
                f"Serie {serie_id} does not belong to tenant {tenant_id}"
            )

        # Update serie with provided fields
        serie = invoice_serie_repository.update(db, db_obj=serie, obj_in=serie_data)

        logger.info(f"Updated invoice serie {serie_id} for tenant {tenant_id}")

        return serie

    def deactivate_serie(
        self,
        db: Session,
        serie_id: int,
        tenant_id: int,
    ) -> InvoiceSerie:
        """
        Deactivate an invoice serie (mark as inactive).

        Args:
            db: Database session
            serie_id: Serie ID
            tenant_id: Tenant ID (for verification)

        Returns:
            InvoiceSerie: Updated serie object

        Raises:
            ValueError: If serie not found or doesn't belong to tenant
        """
        # Get serie and validate
        serie = invoice_serie_repository.get(db, serie_id)
        if not serie:
            raise ValueError(f"Invoice serie {serie_id} not found")

        # Verify serie belongs to tenant
        if serie.tenant_id != tenant_id:
            raise ValueError(
                f"Serie {serie_id} does not belong to tenant {tenant_id}"
            )

        # Deactivate serie
        serie_data = InvoiceSerieUpdate(is_active=False)
        serie = invoice_serie_repository.update(db, db_obj=serie, obj_in=serie_data)

        logger.info(f"Deactivated invoice serie {serie_id} for tenant {tenant_id}")

        return serie

    def activate_serie(
        self,
        db: Session,
        serie_id: int,
        tenant_id: int,
    ) -> InvoiceSerie:
        """
        Activate an invoice serie (mark as active).

        Args:
            db: Database session
            serie_id: Serie ID
            tenant_id: Tenant ID (for verification)

        Returns:
            InvoiceSerie: Updated serie object

        Raises:
            ValueError: If serie not found or doesn't belong to tenant
        """
        # Get serie and validate
        serie = invoice_serie_repository.get(db, serie_id)
        if not serie:
            raise ValueError(f"Invoice serie {serie_id} not found")

        # Verify serie belongs to tenant
        if serie.tenant_id != tenant_id:
            raise ValueError(
                f"Serie {serie_id} does not belong to tenant {tenant_id}"
            )

        # Activate serie
        serie_data = InvoiceSerieUpdate(is_active=True)
        serie = invoice_serie_repository.update(db, db_obj=serie, obj_in=serie_data)

        logger.info(f"Activated invoice serie {serie_id} for tenant {tenant_id}")

        return serie


# Singleton instance
invoice_serie_service = InvoiceSerieService()
