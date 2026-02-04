"""
US-005: Tests de Cifrado de Credenciales de Tenant

Tests for TenantService credential encryption and validation.
"""

import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import IntegrityError

from app.services.tenant import TenantService
from app.schemas.tenant import TenantCreate, TenantUpdate


class TestTenantServiceSlugGeneration:
    """Tests for slug generation and validation in TenantService."""

    @pytest.fixture
    def tenant_service(self) -> TenantService:
        """Create TenantService instance."""
        return TenantService()

    def test_slug_generated_from_name(self, tenant_service):
        """Test: Slug is generated automatically from name."""
        slug = tenant_service._generate_slug("My Company")

        assert slug == "my-company-outlet"

    def test_slug_lowercase(self, tenant_service):
        """Test: Slug is always lowercase."""
        slug = tenant_service._generate_slug("MY COMPANY SAC")

        assert slug == slug.lower()
        assert "my-company-sac-outlet" == slug

    def test_slug_replaces_spaces_with_hyphens(self, tenant_service):
        """Test: Spaces are replaced with hyphens."""
        slug = tenant_service._generate_slug("Hello World Test")

        assert " " not in slug
        assert "hello-world-test-outlet" == slug

    def test_slug_replaces_underscores_with_hyphens(self, tenant_service):
        """Test: Underscores are replaced with hyphens."""
        slug = tenant_service._generate_slug("test_company_123")

        assert "_" not in slug
        assert "test-company-123-outlet" == slug

    def test_slug_removes_special_characters(self, tenant_service):
        """Test: Special characters are removed."""
        slug = tenant_service._generate_slug("Company & Co. (Peru)")

        assert "&" not in slug
        assert "." not in slug
        assert "(" not in slug
        assert ")" not in slug

    def test_slug_has_outlet_suffix(self, tenant_service):
        """Test: Slug ends with -outlet suffix."""
        slug = tenant_service._generate_slug("Test Company")

        assert slug.endswith("-outlet")

    def test_empty_name_raises_error(self, tenant_service):
        """Test: Empty name raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            tenant_service._generate_slug("")

        assert "Cannot generate valid slug" in str(exc_info.value)

    def test_special_chars_only_raises_error(self, tenant_service):
        """Test: Name with only special characters raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            tenant_service._generate_slug("!@#$%^&*()")

        assert "Cannot generate valid slug" in str(exc_info.value)


class TestTenantServiceDuplicateValidation:
    """Tests for duplicate tenant validation."""

    @pytest.fixture
    def tenant_service(self) -> TenantService:
        """Create TenantService instance."""
        return TenantService()

    @pytest.mark.asyncio
    async def test_duplicate_slug_raises_error(self, tenant_service, mock_db):
        """Test: Creating tenant with existing slug raises ValueError."""
        with patch.object(tenant_service, "get_tenant_by_slug") as mock_get:
            mock_get.return_value = MagicMock(id=1)  # Existing tenant

            tenant_create = TenantCreate(
                name="Test Company",
                slug="existing-slug-outlet",
                company_id="auth0|new",
            )

            with pytest.raises(ValueError) as exc_info:
                await tenant_service.create_tenant(mock_db, tenant_create)

            assert "already exists" in str(exc_info.value)
            assert "slug" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_duplicate_company_id_raises_error(self, tenant_service, mock_db):
        """Test: Creating tenant with existing company_id raises ValueError."""
        with patch.object(tenant_service, "get_tenant_by_slug") as mock_get:
            mock_get.return_value = None  # Slug is unique

            # Simulate IntegrityError on company_id
            mock_db.commit.side_effect = IntegrityError(
                statement="INSERT",
                params={},
                orig=Exception("duplicate key value violates unique constraint \"company_id\""),
            )

            tenant_create = TenantCreate(
                name="Test Company",
                company_id="auth0|existing",
            )

            with pytest.raises(ValueError) as exc_info:
                await tenant_service.create_tenant(mock_db, tenant_create)

            assert "company_id" in str(exc_info.value)
            assert "already exists" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_unique_slug_and_company_id_succeeds(self, tenant_service, mock_db):
        """Test: Creating tenant with unique slug and company_id succeeds."""
        with patch.object(tenant_service, "get_tenant_by_slug") as mock_get:
            mock_get.return_value = None  # Slug is unique

            tenant_create = TenantCreate(
                name="New Company",
                company_id="auth0|new123",
            )

            # No exception on commit
            mock_db.commit.return_value = None

            result = await tenant_service.create_tenant(mock_db, tenant_create)

            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()


class TestTenantServiceEcommerceSettings:
    """Tests for e-commerce settings in TenantService."""

    @pytest.fixture
    def tenant_service(self) -> TenantService:
        """Create TenantService instance."""
        return TenantService()

    def test_shopify_settings_built_correctly(self, tenant_service):
        """Test: Shopify e-commerce settings are built correctly with OAuth2."""
        tenant_create = TenantCreate(
            name="Shopify Store",
            company_id="auth0|shop1",
            ecommerce_platform="shopify",
            ecommerce_store_url="https://mystore.myshopify.com",
            shopify_client_id="test_client_id",
            shopify_client_secret="test_client_secret",
            shopify_api_version="2025-10",
            sync_on_validation=True,
        )

        settings = tenant_service._build_ecommerce_settings(tenant_create)

        assert settings.sync_on_validation is True
        assert settings.shopify is not None
        assert settings.shopify.store_url == "https://mystore.myshopify.com"
        assert settings.shopify.client_id == "test_client_id"
        assert settings.shopify.client_secret == "test_client_secret"
        assert settings.shopify.api_version == "2025-10"
        assert settings.shopify.access_token is None  # Not generated yet
        assert settings.shopify.access_token_expires_at is None
        assert settings.woocommerce is None

    def test_woocommerce_settings_built_correctly(self, tenant_service):
        """Test: WooCommerce e-commerce settings are built correctly."""
        tenant_create = TenantCreate(
            name="WooCommerce Store",
            company_id="auth0|woo1",
            ecommerce_platform="woocommerce",
            ecommerce_store_url="https://mystore.com",
            ecommerce_consumer_key="ck_secret",
            ecommerce_consumer_secret="cs_secret",
            sync_on_validation=True,
        )

        settings = tenant_service._build_ecommerce_settings(tenant_create)

        assert settings.sync_on_validation is True
        assert settings.woocommerce is not None
        assert settings.woocommerce.store_url == "https://mystore.com"
        assert settings.woocommerce.consumer_key == "ck_secret"
        assert settings.woocommerce.consumer_secret == "cs_secret"
        assert settings.shopify is None

    def test_no_platform_returns_minimal_settings(self, tenant_service):
        """Test: No e-commerce platform returns minimal settings."""
        tenant_create = TenantCreate(
            name="No Ecommerce",
            company_id="auth0|noecom",
            sync_on_validation=False,
        )

        settings = tenant_service._build_ecommerce_settings(tenant_create)

        assert settings.sync_on_validation is False
        assert settings.shopify is None
        assert settings.woocommerce is None


class TestTenantServiceImmutableFields:
    """Tests for immutable field protection in TenantService."""

    @pytest.fixture
    def tenant_service(self) -> TenantService:
        """Create TenantService instance."""
        return TenantService()

    @pytest.mark.asyncio
    async def test_cannot_update_is_platform(self, tenant_service, mock_db):
        """Test: Attempting to update is_platform raises ValueError."""
        with patch.object(tenant_service, "get_tenant") as mock_get:
            mock_tenant = MagicMock()
            mock_tenant.id = 1
            mock_get.return_value = mock_tenant

            update = TenantUpdate(is_platform=True)

            with pytest.raises(ValueError) as exc_info:
                await tenant_service.update_tenant(mock_db, 1, update)

            assert "immutable" in str(exc_info.value).lower()
            assert "is_platform" in str(exc_info.value)


class TestTenantServiceCRUD:
    """Tests for basic CRUD operations in TenantService."""

    @pytest.fixture
    def tenant_service(self) -> TenantService:
        """Create TenantService instance."""
        return TenantService()

    def test_get_tenant_by_id(self, tenant_service, mock_db):
        """Test: Get tenant by ID."""
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(id=1)

        result = tenant_service.get_tenant(mock_db, 1)

        assert result.id == 1

    def test_get_tenant_not_found_returns_none(self, tenant_service, mock_db):
        """Test: Get non-existent tenant returns None."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = tenant_service.get_tenant(mock_db, 999)

        assert result is None

    def test_get_tenant_by_slug(self, tenant_service, mock_db):
        """Test: Get tenant by slug."""
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(
            slug="test-outlet"
        )

        result = tenant_service.get_tenant_by_slug(mock_db, "test-outlet")

        assert result.slug == "test-outlet"

    def test_deactivate_tenant_sets_inactive(self, tenant_service, mock_db):
        """Test: Deactivate tenant sets is_active=False."""
        with patch.object(tenant_service, "get_tenant") as mock_get, \
             patch("app.services.tenant.tenant_repository") as mock_repo:

            mock_tenant = MagicMock()
            mock_tenant.id = 1
            mock_tenant.is_platform = False
            mock_get.return_value = mock_tenant

            result = tenant_service.deactivate_tenant(mock_db, 1)

            assert result is True
            mock_repo.update.assert_called_once()

    def test_cannot_deactivate_platform_tenant(self, tenant_service, mock_db):
        """Test: Cannot deactivate platform tenant."""
        with patch.object(tenant_service, "get_tenant") as mock_get:
            mock_tenant = MagicMock()
            mock_tenant.id = 1
            mock_tenant.is_platform = True  # Platform tenant
            mock_get.return_value = mock_tenant

            with pytest.raises(ValueError) as exc_info:
                tenant_service.deactivate_tenant(mock_db, 1)

            assert "platform tenant" in str(exc_info.value).lower()

    def test_deactivate_nonexistent_returns_false(self, tenant_service, mock_db):
        """Test: Deactivate non-existent tenant returns False."""
        with patch.object(tenant_service, "get_tenant") as mock_get:
            mock_get.return_value = None

            result = tenant_service.deactivate_tenant(mock_db, 999)

            assert result is False
