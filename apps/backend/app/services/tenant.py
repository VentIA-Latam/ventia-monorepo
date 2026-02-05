"""
Tenant service - business logic for tenant management.
"""

import logging
import secrets

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.repositories.tenant import tenant_repository
from app.schemas.tenant import TenantCreate, TenantUpdate
from app.schemas.tenant_settings import (
    EcommerceSettings,
    ShopifyCredentials,
    WooCommerceCredentials,
)

logger = logging.getLogger(__name__)


class TenantService:
    """Service for managing tenants (companies/clients)."""

    def get_tenant(self, db: Session, tenant_id: int) -> Tenant | None:
        """
        Get tenant by ID.

        Args:
            db: Database session
            tenant_id: Tenant ID

        Returns:
            Tenant if found, None otherwise
        """
        return db.query(Tenant).filter(Tenant.id == tenant_id).first()

    def get_tenant_by_slug(self, db: Session, slug: str) -> Tenant | None:
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
        is_active: bool | None = None,
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

    async def create_tenant(self, db: Session, tenant_in: TenantCreate) -> Tenant:
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

        **OAuth2 Token Generation:**
        - For Shopify tenants with OAuth credentials, automatically generates the
          initial access token after tenant creation.

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
            # Emisor data for electronic invoicing
            emisor_nombre_comercial=tenant_in.emisor_nombre_comercial,
            emisor_ubigeo=tenant_in.emisor_ubigeo,
            emisor_departamento=tenant_in.emisor_departamento,
            emisor_provincia=tenant_in.emisor_provincia,
            emisor_distrito=tenant_in.emisor_distrito,
            emisor_direccion=tenant_in.emisor_direccion,
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
                raise ValueError(
                    f"Tenant with company_id '{tenant_in.company_id}' already exists"
                ) from e
            elif "slug" in error_str:
                raise ValueError(f"Tenant with slug '{slug}' already exists") from e
            else:
                # Re-raise for other integrity errors
                raise ValueError(f"Failed to create tenant: {str(e.orig)}") from e

        # Generate initial access token for Shopify if OAuth credentials provided
        if tenant_in.ecommerce_platform == "shopify" and tenant_in.shopify_client_id:
            import logging

            from app.integrations.shopify_token_manager import shopify_token_manager

            logger = logging.getLogger(__name__)

            try:
                # This will generate and store the first access token
                await shopify_token_manager.get_valid_access_token(db, tenant)
                logger.info(f"Generated initial Shopify access token for tenant {tenant.id}")
            except ValueError as e:
                logger.error(
                    f"Failed to generate initial Shopify token for tenant {tenant.id}: {str(e)}"
                )
                # Don't fail tenant creation, token can be regenerated later

        # Auto-subscribe to webhooks if ecommerce credentials are complete
        if tenant_in.ecommerce_platform == "shopify":
            await self._auto_subscribe_shopify_webhooks(db, tenant, ecommerce_settings.shopify)
        elif tenant_in.ecommerce_platform == "woocommerce":
            await self._auto_subscribe_woocommerce_webhooks(db, tenant, ecommerce_settings.woocommerce)

        return tenant

    def _build_ecommerce_settings(self, tenant_in: TenantCreate) -> EcommerceSettings:
        """
        Build EcommerceSettings from TenantCreate fields.

        For Shopify: Uses OAuth2 (client_id/client_secret). Access token will be
        generated automatically by ShopifyTokenManager after tenant creation.

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
                    api_version=tenant_in.shopify_api_version or "2025-10",
                    client_id=tenant_in.shopify_client_id,
                    client_secret=tenant_in.shopify_client_secret,
                    access_token=None,  # Will be generated by TokenManager
                    access_token_expires_at=None,
                ),
            )
        elif tenant_in.ecommerce_platform == "woocommerce":
            # Generate webhook_secret if not provided
            webhook_secret = getattr(tenant_in, "webhook_secret", None)
            if not webhook_secret:
                webhook_secret = secrets.token_urlsafe(32)
                logger.info("Generated new webhook_secret for new WooCommerce tenant")

            return EcommerceSettings(
                sync_on_validation=tenant_in.sync_on_validation,
                woocommerce=WooCommerceCredentials(
                    store_url=tenant_in.ecommerce_store_url or "",
                    consumer_key=tenant_in.ecommerce_consumer_key,
                    consumer_secret=tenant_in.ecommerce_consumer_secret,
                    webhook_secret=webhook_secret,
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

    async def update_tenant(self, db: Session, tenant_id: int, tenant_in: TenantUpdate) -> Tenant | None:
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
            "ecommerce_platform",
            "ecommerce_store_url",
            "shopify_client_id",
            "shopify_client_secret",
            "shopify_api_version",
            "ecommerce_consumer_key",
            "ecommerce_consumer_secret",
            "sync_on_validation",
        }

        has_ecommerce_update = any(f in update_data for f in ecommerce_fields)

        # Update regular fields
        for field, value in update_data.items():
            if field in ecommerce_fields:
                continue  # Handle separately
            setattr(tenant, field, value)

        # Handle e-commerce settings update
        if has_ecommerce_update:
            await self._update_ecommerce_settings(db, tenant, update_data)

        db.commit()
        db.refresh(tenant)

        return tenant

    async def _update_ecommerce_settings(self, db: Session, tenant: Tenant, update_data: dict) -> None:
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
                    store_url=update_data.get("ecommerce_store_url")
                    or (current_shopify.store_url if current_shopify else ""),
                    client_id=update_data.get("shopify_client_id")
                    or (current_shopify.client_id if current_shopify else None),
                    client_secret=update_data.get("shopify_client_secret")
                    or (current_shopify.client_secret if current_shopify else None),
                    api_version=update_data.get("shopify_api_version")
                    or (current_shopify.api_version if current_shopify else "2024-01"),
                ),
            )
            tenant.set_ecommerce_settings(new_settings)

            # Auto-subscribe to Shopify webhooks if credentials are complete
            await self._auto_subscribe_shopify_webhooks(db, tenant, new_settings.shopify)

        elif platform == "woocommerce":
            # Get current WooCommerce settings if available
            current_woo = current_ecommerce.woocommerce if current_ecommerce else None

            # Generate webhook_secret if not provided
            webhook_secret = update_data.get("webhook_secret")
            if not webhook_secret:
                if current_woo and current_woo.webhook_secret:
                    # Keep existing secret
                    webhook_secret = current_woo.webhook_secret
                else:
                    # Generate new secure secret
                    webhook_secret = secrets.token_urlsafe(32)
                    logger.info(f"Generated new webhook_secret for WooCommerce tenant {tenant.id}")

            new_settings = EcommerceSettings(
                sync_on_validation=sync_on_validation,
                woocommerce=WooCommerceCredentials(
                    store_url=update_data.get("ecommerce_store_url")
                    or (current_woo.store_url if current_woo else ""),
                    consumer_key=update_data.get("ecommerce_consumer_key")
                    or (current_woo.consumer_key if current_woo else None),
                    consumer_secret=update_data.get("ecommerce_consumer_secret")
                    or (current_woo.consumer_secret if current_woo else None),
                    webhook_secret=webhook_secret,
                ),
            )
            tenant.set_ecommerce_settings(new_settings)

            # Auto-subscribe to WooCommerce webhooks if credentials are complete
            await self._auto_subscribe_woocommerce_webhooks(db, tenant, new_settings.woocommerce)

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

    def get_tenant_stats(self, db: Session, tenant_id: int) -> dict | None:
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
            .filter(User.tenant_id == tenant_id, User.is_active)
            .scalar()
        )

        # Count total orders
        order_count = db.query(func.count(Order.id)).filter(Order.tenant_id == tenant_id).scalar()

        return {
            "user_count": user_count or 0,
            "order_count": order_count or 0,
        }

    async def _auto_subscribe_shopify_webhooks(
        self,
        db: Session,
        tenant: Tenant,
        shopify_credentials: ShopifyCredentials | None,
    ) -> None:
        """
        Automatically subscribe to Shopify webhooks after credentials are saved.

        Args:
            db: Database session
            tenant: Tenant with updated credentials
            shopify_credentials: Shopify credentials (may be None if incomplete)
        """
        # Skip if credentials are incomplete
        if not shopify_credentials or not shopify_credentials.client_id or not shopify_credentials.client_secret:
            logger.info(f"Skipping Shopify webhook subscription for tenant {tenant.id}: incomplete credentials")
            return

        # Skip if store_url is missing
        if not shopify_credentials.store_url:
            logger.info(f"Skipping Shopify webhook subscription for tenant {tenant.id}: missing store_url")
            return

        try:
            from app.integrations.shopify_client import ShopifyClient
            from app.integrations.shopify_token_manager import shopify_token_manager
            from app.services.webhook_subscription_service import WebhookSubscriptionService

            # Get valid access token
            access_token = await shopify_token_manager.get_valid_access_token(db, tenant)

            # Create Shopify client
            shopify_client = ShopifyClient(
                store_url=shopify_credentials.store_url,
                access_token=access_token,
                api_version=shopify_credentials.api_version or "2024-01",
            )

            # Subscribe to webhooks
            webhook_service = WebhookSubscriptionService(db)
            result = await webhook_service.subscribe_shopify_webhooks(
                tenant_id=tenant.id,
                shopify_client=shopify_client,
            )

            logger.info(
                f"Shopify webhook subscription result for tenant {tenant.id}: "
                f"created={result['created']}, skipped={result['skipped']}, failed={result['failed']}"
            )

        except Exception as e:
            # Don't fail the whole operation if webhook subscription fails
            logger.error(
                f"Failed to auto-subscribe Shopify webhooks for tenant {tenant.id}: {str(e)}",
                exc_info=True,
            )

    async def _auto_subscribe_woocommerce_webhooks(
        self,
        db: Session,
        tenant: Tenant,
        woo_credentials: WooCommerceCredentials | None,
    ) -> None:
        """
        Automatically subscribe to WooCommerce webhooks after credentials are saved.

        Args:
            db: Database session
            tenant: Tenant with updated credentials
            woo_credentials: WooCommerce credentials (may be None if incomplete)
        """
        # Skip if credentials are incomplete
        if not woo_credentials or not woo_credentials.consumer_key or not woo_credentials.consumer_secret:
            logger.info(f"Skipping WooCommerce webhook subscription for tenant {tenant.id}: incomplete credentials")
            return

        # Skip if store_url or webhook_secret is missing
        if not woo_credentials.store_url or not woo_credentials.webhook_secret:
            logger.info(f"Skipping WooCommerce webhook subscription for tenant {tenant.id}: missing store_url or webhook_secret")
            return

        try:
            from app.integrations.woocommerce_client import WooCommerceClient
            from app.services.webhook_subscription_service import WebhookSubscriptionService

            # Create WooCommerce client
            woo_client = WooCommerceClient(
                store_url=woo_credentials.store_url,
                consumer_key=woo_credentials.consumer_key,
                consumer_secret=woo_credentials.consumer_secret,
            )

            # Subscribe to webhooks
            webhook_service = WebhookSubscriptionService(db)
            result = await webhook_service.subscribe_woocommerce_webhooks(
                tenant_id=tenant.id,
                woocommerce_client=woo_client,
                webhook_secret=woo_credentials.webhook_secret,
            )

            logger.info(
                f"WooCommerce webhook subscription result for tenant {tenant.id}: "
                f"created={result['created']}, skipped={result['skipped']}, failed={result['failed']}"
            )

        except Exception as e:
            # Don't fail the whole operation if webhook subscription fails
            logger.error(
                f"Failed to auto-subscribe WooCommerce webhooks for tenant {tenant.id}: {str(e)}",
                exc_info=True,
            )


# Singleton instance
tenant_service = TenantService()
