"""
Tenant repository.
"""

from sqlalchemy import or_
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

    def get_all(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        search: str | None = None,
        is_active: bool | None = None,
        is_platform: bool | None = None,
    ) -> list[Tenant]:
        """Get all tenants with optional filters and pagination."""
        query = db.query(Tenant)
        if search:
            pattern = f"%{search}%"
            query = query.filter(or_(
                Tenant.name.ilike(pattern),
                Tenant.slug.ilike(pattern),
            ))
        if is_active is not None:
            query = query.filter(Tenant.is_active == is_active)
        if is_platform is not None:
            query = query.filter(Tenant.is_platform == is_platform)
        return query.order_by(Tenant.created_at.desc()).offset(skip).limit(limit).all()

    def count_all(
        self,
        db: Session,
        *,
        search: str | None = None,
        is_active: bool | None = None,
        is_platform: bool | None = None,
    ) -> int:
        """Count tenants with same filters as get_all."""
        query = db.query(Tenant)
        if search:
            pattern = f"%{search}%"
            query = query.filter(or_(
                Tenant.name.ilike(pattern),
                Tenant.slug.ilike(pattern),
            ))
        if is_active is not None:
            query = query.filter(Tenant.is_active == is_active)
        if is_platform is not None:
            query = query.filter(Tenant.is_platform == is_platform)
        return query.count()

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
