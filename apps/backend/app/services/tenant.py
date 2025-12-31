"""
Tenant service - business logic for tenant management.
"""

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate
from app.repositories.tenant import tenant_repository


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

        Automatically generates slug from name if not provided.
        Validates that slug is unique before creation.
        Sets is_platform=False by default (new tenants are clients, not platform).

        **Encryption**: shopify_access_token is sent as plaintext in request body
        but is automatically encrypted by the Tenant model's @property setter
        before being stored in the database.

        Args:
            db: Database session
            tenant_in: Tenant creation data (shopify_access_token in plaintext)

        Returns:
            Created tenant with ID

        Raises:
            ValueError: If slug/company_id already exists or if generation fails
        """
        # Auto-generate slug from name if not provided
        slug = tenant_in.slug
        if not slug:
            slug = self._generate_slug(tenant_in.name)

        # Check if slug already exists
        existing = self.get_tenant_by_slug(db, slug)
        if existing:
            raise ValueError(f"Tenant with slug '{slug}' already exists")

        # Create tenant with basic info
        tenant = Tenant(
            name=tenant_in.name,
            slug=slug,
            company_id=tenant_in.company_id,
            shopify_store_url=tenant_in.shopify_store_url,
            shopify_api_version=tenant_in.shopify_api_version or "2024-01",
            is_platform=False,  # New tenants are always clients, not platform
            is_active=True,
        )

        # Set Shopify token (required in TenantCreate)
        # The @property setter automatically encrypts it before storing
        tenant.shopify_access_token = tenant_in.shopify_access_token

        try:
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        except IntegrityError as e:
            db.rollback()
            
            # Handle unique constraint violations with user-friendly messages
            error_str = str(e.orig)
            if "company_id" in error_str:
                raise ValueError(f"Tenant with company_id '{tenant_in.company_id}' already exists")
            elif "slug" in error_str:
                raise ValueError(f"Tenant with slug '{slug}' already exists")
            else:
                # Re-raise for other integrity errors
                raise ValueError(f"Failed to create tenant: {str(e.orig)}")

        return tenant

    def _generate_slug(self, name: str) -> str:
        """
        Generate a kebab-case slug from a name with "-outlet" suffix.

        Examples:
            "My Company" -> "my-company-outlet"
            "Test_123" -> "test-123-outlet"
            "hello world test" -> "hello-world-test-outlet"

        Args:
            name: Company name

        Returns:
            Generated slug in kebab-case format with "-outlet" suffix

        Raises:
            ValueError: If slug generation fails or results in empty string
        """
        import re

        # Convert to lowercase
        slug = name.lower()

        # Replace spaces and underscores with hyphens
        slug = re.sub(r"[\s_]+", "-", slug)

        # Remove any characters that aren't alphanumeric or hyphens
        slug = re.sub(r"[^a-z0-9\-]", "", slug)

        # Remove consecutive hyphens
        slug = re.sub(r"-+", "-", slug)

        # Remove leading/trailing hyphens
        slug = slug.strip("-")

        if not slug:
            raise ValueError(f"Cannot generate valid slug from name '{name}'")

        # Add "-outlet" suffix
        slug = f"{slug}-outlet"

        # Ensure max length (100 chars)
        slug = slug[:100]

        return slug

    def update_tenant(
        self, db: Session, tenant_id: int, tenant_in: TenantUpdate
    ) -> Optional[Tenant]:
        """
        Update tenant fields.

        **Updatable fields:**
        - name, shopify_store_url, shopify_access_token, shopify_api_version, is_active

        **Immutable fields (cannot be changed):**
        - slug, id, is_platform (set at creation)

        The updated_at timestamp is automatically updated by SQLAlchemy.

        **Encryption**: shopify_access_token is sent as plaintext in request body
        but is automatically encrypted by the Tenant model's @property setter
        before being stored in the database.

        Args:
            db: Database session
            tenant_id: Tenant ID to update
            tenant_in: Update data (only provided fields will be updated)

        Returns:
            Updated tenant if found, None otherwise

        Raises:
            ValueError: If validation fails or attempting to modify immutable fields
        """
        tenant = self.get_tenant(db, tenant_id)
        if not tenant:
            return None

        # Extract update data (only fields that were explicitly provided)
        update_data = tenant_in.model_dump(exclude_unset=True)

        # Check if trying to update immutable fields (which schema shouldn't allow, but validate anyway)
        immutable_fields = {"slug", "id", "is_platform", "company_id"}
        attempted_immutable = set(update_data.keys()) & immutable_fields
        if attempted_immutable:
            raise ValueError(f"Cannot modify immutable fields: {', '.join(attempted_immutable)}")

        # Update allowed fields
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
        if tenant.is_platform is True:
            raise ValueError("Cannot deactivate the VentIA platform tenant")

        # Mark tenant as inactive using repository update
        tenant_update = TenantUpdate(is_active=False)
        tenant_repository.update(db, db_obj=tenant, obj_in=tenant_update)

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
