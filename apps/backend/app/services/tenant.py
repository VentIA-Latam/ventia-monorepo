"""
Tenant service - business logic for tenant management.
"""

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate
from app.schemas.tenant_settings import (
    EcommerceSettings,
    ShopifyCredentials,
    WooCommerceCredentials,
)
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

        **E-commerce Configuration:**
        - Supports Shopify and WooCommerce via ecommerce_* fields
        - Builds settings.ecommerce JSON with encrypted credentials

        **Encryption**: All credentials (access_token, consumer_key, consumer_secret)
        are automatically encrypted before being stored in the settings JSON field.

        Args:
            db: Database session
            tenant_in: Tenant creation data

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
            is_platform=False,  # New tenants are always clients, not platform
            is_active=True,
            efact_ruc=tenant_in.efact_ruc,
        )

        # Build e-commerce settings if platform is specified
        if tenant_in.ecommerce_platform:
            ecommerce_settings = self._build_ecommerce_settings(tenant_in)
            tenant.set_ecommerce_settings(ecommerce_settings)

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

    def _build_ecommerce_settings(self, tenant_in: TenantCreate) -> EcommerceSettings:
        """
        Build EcommerceSettings from TenantCreate fields.
        
        Args:
            tenant_in: TenantCreate with ecommerce_* fields
            
        Returns:
            EcommerceSettings object ready for encryption and storage
        """
        if tenant_in.ecommerce_platform == "shopify":
            return EcommerceSettings(
                sync_on_validation=tenant_in.sync_on_validation,
                shopify=ShopifyCredentials(
                    store_url=tenant_in.ecommerce_store_url or "",
                    access_token=tenant_in.ecommerce_access_token,
                    api_version=tenant_in.shopify_api_version,
                ),
            )
        elif tenant_in.ecommerce_platform == "woocommerce":
            return EcommerceSettings(
                sync_on_validation=tenant_in.sync_on_validation,
                woocommerce=WooCommerceCredentials(
                    store_url=tenant_in.ecommerce_store_url or "",
                    consumer_key=tenant_in.ecommerce_consumer_key,
                    consumer_secret=tenant_in.ecommerce_consumer_secret,
                ),
            )
        else:
            return EcommerceSettings(sync_on_validation=tenant_in.sync_on_validation)

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
        - name, is_active, efact_ruc
        - E-commerce: ecommerce_platform, ecommerce_store_url, credentials, sync_on_validation

        **Immutable fields (cannot be changed):**
        - slug, id, is_platform (set at creation)

        **E-commerce Configuration:**
        - If ecommerce_platform is provided, rebuilds settings.ecommerce
        - Credentials are encrypted before storage

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

        # Check if trying to update immutable fields
        immutable_fields = {"slug", "id", "is_platform", "company_id"}
        attempted_immutable = set(update_data.keys()) & immutable_fields
        if attempted_immutable:
            raise ValueError(f"Cannot modify immutable fields: {', '.join(attempted_immutable)}")

        # Separate e-commerce fields from regular fields
        ecommerce_fields = {
            "ecommerce_platform", "ecommerce_store_url", "ecommerce_access_token",
            "shopify_api_version", "ecommerce_consumer_key", "ecommerce_consumer_secret",
            "sync_on_validation"
        }
        
        has_ecommerce_update = any(f in update_data for f in ecommerce_fields)

        # Update regular fields
        for field, value in update_data.items():
            if field in ecommerce_fields:
                continue  # Handle separately
            setattr(tenant, field, value)

        # Handle e-commerce settings update
        if has_ecommerce_update:
            self._update_ecommerce_settings(tenant, update_data)

        db.commit()
        db.refresh(tenant)

        return tenant

    def _update_ecommerce_settings(
        self, tenant: Tenant, update_data: dict
    ) -> None:
        """
        Update e-commerce settings for a tenant.
        
        Args:
            tenant: Tenant to update
            update_data: Dictionary with ecommerce_* fields
        """
        # Get current settings or create new
        current_settings = tenant.get_settings()
        current_ecommerce = current_settings.ecommerce
        
        # Determine platform (new value or keep current)
        platform = update_data.get("ecommerce_platform")
        if platform is None and current_ecommerce:
            platform = current_ecommerce.platform
        
        # Determine sync setting
        sync_on_validation = update_data.get("sync_on_validation")
        if sync_on_validation is None:
            sync_on_validation = current_ecommerce.sync_on_validation if current_ecommerce else True
        
        if platform == "shopify":
            # Get current Shopify settings if available
            current_shopify = current_ecommerce.shopify if current_ecommerce else None

            new_settings = EcommerceSettings(
                sync_on_validation=sync_on_validation,
                shopify=ShopifyCredentials(
                    store_url=update_data.get("ecommerce_store_url") or
                              (current_shopify.store_url if current_shopify else ""),
                    access_token=update_data.get("ecommerce_access_token") or
                                 (current_shopify.access_token if current_shopify else None),
                    api_version=update_data.get("shopify_api_version") or
                                (current_shopify.api_version if current_shopify else "2024-01"),
                ),
            )
            tenant.set_ecommerce_settings(new_settings)
            
        elif platform == "woocommerce":
            # Get current WooCommerce settings if available
            current_woo = current_ecommerce.woocommerce if current_ecommerce else None
            
            new_settings = EcommerceSettings(
                sync_on_validation=sync_on_validation,
                woocommerce=WooCommerceCredentials(
                    store_url=update_data.get("ecommerce_store_url") or
                              (current_woo.store_url if current_woo else ""),
                    consumer_key=update_data.get("ecommerce_consumer_key") or
                                 (current_woo.consumer_key if current_woo else None),
                    consumer_secret=update_data.get("ecommerce_consumer_secret") or
                                    (current_woo.consumer_secret if current_woo else None),
                ),
            )
            tenant.set_ecommerce_settings(new_settings)
            
        else:
            # No platform - just update sync setting
            new_settings = EcommerceSettings(sync_on_validation=sync_on_validation)
            tenant.set_ecommerce_settings(new_settings)

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
