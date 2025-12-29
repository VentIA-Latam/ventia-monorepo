"""
Tenant service - business logic for tenant management.
"""

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate


class TenantService:
    """Service for managing tenants (companies/clients)."""

    def get_tenant(self, db: Session, tenant_id: int) -> Optional[Tenant]:
        """
        Get tenant by ID.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            Tenant if found, None otherwise
        """
        return db.query(Tenant).filter(Tenant.id == tenant_id).first()

    def get_tenant_by_slug(self, db: Session, slug: str) -> Optional[Tenant]:
        """
        Get tenant by slug.

        Args:
            db: Database session
            slug: Tenant slug (URL-friendly identifier)

        Returns:
            Tenant if found, None otherwise
        """
        return db.query(Tenant).filter(Tenant.slug == slug).first()

    def get_tenants(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
    ) -> tuple[list[Tenant], int]:
        """
        Get all tenants with pagination.

        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum records to return
            is_active: Filter by active status (None = all)

        Returns:
            Tuple of (list of tenants, total count)
        """
        query = db.query(Tenant)

        # Filter by active status if specified
        if is_active is not None:
            query = query.filter(Tenant.is_active == is_active)

        # Get total count before pagination
        total = query.count()

        # Apply pagination and ordering
        tenants = query.order_by(Tenant.created_at.desc()).offset(skip).limit(limit).all()

        return tenants, total

    def create_tenant(self, db: Session, tenant_in: TenantCreate) -> Tenant:
        """
        Create a new tenant.

        Shopify credentials are optional at creation and can be added later via update.

        **Encryption**: shopify_access_token is sent as plaintext in request body
        but is automatically encrypted by the Tenant model's @property setter
        before being stored in the database.

        Args:
            db: Database session
            tenant_in: Tenant creation data (shopify_access_token in plaintext)

        Returns:
            Created tenant

        Raises:
            ValueError: If slug already exists
        """
        # Check if slug already exists
        existing = self.get_tenant_by_slug(db, tenant_in.slug)
        if existing:
            raise ValueError(f"Tenant with slug '{tenant_in.slug}' already exists")

        # Create tenant with basic info
        tenant = Tenant(
            name=tenant_in.name,
            slug=tenant_in.slug,
            company_id=tenant_in.company_id,
            shopify_store_url=tenant_in.shopify_store_url,
            shopify_api_version=tenant_in.shopify_api_version or "2024-01",
            is_platform=False,  # New tenants are always clients, not platform
            is_active=True,
        )

        # Set Shopify token if provided (optional at creation)
        # The @property setter automatically encrypts it before storing
        if tenant_in.shopify_access_token:
            tenant.shopify_access_token = tenant_in.shopify_access_token  # plaintext -> encrypted

        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        return tenant

    def update_tenant(
        self, db: Session, tenant_id: int, tenant_in: TenantUpdate
    ) -> Optional[Tenant]:
        """
        Update tenant.

        Commonly used to add/update Shopify credentials after tenant creation.

        **Encryption**: shopify_access_token is sent as plaintext in request body
        but is automatically encrypted by the Tenant model's @property setter
        before being stored in the database.

        Args:
            db: Database session
            tenant_id: Tenant ID to update
            tenant_in: Update data (shopify_access_token in plaintext if provided)

        Returns:
            Updated tenant if found, None otherwise

        Raises:
            ValueError: If validation fails
        """
        tenant = self.get_tenant(db, tenant_id)
        if not tenant:
            return None

        # Don't allow changing is_platform after creation
        if tenant_in.is_platform is not None and tenant_in.is_platform != tenant.is_platform:
            raise ValueError("Cannot change is_platform after tenant creation")

        # Update fields that are provided
        update_data = tenant_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "shopify_access_token":
                # Use property setter for automatic encryption (plaintext -> encrypted)
                # Even if value is None, this clears the encrypted token
                tenant.shopify_access_token = value
            else:
                setattr(tenant, field, value)

        db.commit()
        db.refresh(tenant)

        return tenant

    def deactivate_tenant(self, db: Session, tenant_id: int) -> bool:
        """
        Deactivate a tenant (soft delete).

        Args:
            db: Database session
            tenant_id: Tenant ID to deactivate

        Returns:
            True if deactivated, False if not found

        Raises:
            ValueError: If trying to deactivate platform tenant
        """
        tenant = self.get_tenant(db, tenant_id)
        if not tenant:
            return False

        # Don't allow deactivating platform tenant
        if tenant.is_platform:
            raise ValueError("Cannot deactivate the VentIA platform tenant")

        tenant.is_active = False
        db.commit()

        return True

    def get_tenant_stats(self, db: Session, tenant_id: int) -> Optional[dict]:
        """
        Get statistics for a tenant.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            Dictionary with stats (user_count, order_count) or None if not found
        """
        from app.models.order import Order
        from app.models.user import User

        tenant = self.get_tenant(db, tenant_id)
        if not tenant:
            return None

        # Count active users
        user_count = (
            db.query(func.count(User.id))
            .filter(User.tenant_id == tenant_id, User.is_active == True)
            .scalar()
        )

        # Count total orders
        order_count = db.query(func.count(Order.id)).filter(Order.tenant_id == tenant_id).scalar()

        return {
            "user_count": user_count or 0,
            "order_count": order_count or 0,
        }


# Singleton instance
tenant_service = TenantService()
