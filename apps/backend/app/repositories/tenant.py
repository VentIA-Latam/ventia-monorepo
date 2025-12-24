"""
Tenant repository.
"""

from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.repositories.base import CRUDBase
from app.schemas.tenant import TenantCreate, TenantUpdate


class TenantRepository(CRUDBase[Tenant, TenantCreate, TenantUpdate]):
    """Repository for Tenant model."""

    def get_by_slug(self, db: Session, slug: str) -> Tenant | None:
        """
        Get tenant by slug.

        Args:
            db: Database session
            slug: Tenant slug

        Returns:
            Tenant or None
        """
        return db.query(Tenant).filter(Tenant.slug == slug).first()

    def get_by_company_id(self, db: Session, company_id: str) -> Tenant | None:
        """
        Get tenant by company_id (Auth0 organization ID).

        Args:
            db: Database session
            company_id: Company ID from Auth0

        Returns:
            Tenant or None
        """
        return db.query(Tenant).filter(Tenant.company_id == company_id).first()

    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[Tenant]:
        """
        Get all active tenants.

        Args:
            db: Database session
            skip: Number to skip
            limit: Max results

        Returns:
            List of active tenants
        """
        return (
            db.query(Tenant)
            .filter(Tenant.is_active == True)
            .offset(skip)
            .limit(limit)
            .all()
        )


# Global repository instance
tenant_repository = TenantRepository(Tenant)
