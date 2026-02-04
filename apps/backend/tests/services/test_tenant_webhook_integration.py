"""
Simplified integration tests for TenantService webhook auto-subscription.

Tests the automatic creation of webhook subscriptions when
tenant e-commerce credentials are saved or updated.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.tenant import Tenant
from app.schemas.tenant import TenantUpdate
from app.schemas.tenant_settings import EcommerceSettings, WooCommerceCredentials
from app.services.tenant import TenantService


@pytest.fixture
def tenant_service():
    """Create TenantService instance."""
    return TenantService()


@pytest.fixture
def mock_db():
    """Create mock database session."""
    db = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock()
    db.query = MagicMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def sample_tenant(mock_db):
    """Create a sample tenant for testing with working settings methods."""
    from app.schemas.tenant_settings import TenantSettings, EcommerceSettings

    tenant = Tenant(
        id=1,
        name="Test Company",
        slug="test-company-outlet",
        company_id="TEST001",
        is_active=True,
        is_platform=False,
    )

    # Store settings in a local variable that persists
    stored_settings = {"ecommerce": None}

    # Mock get_settings to return stored settings
    def mock_get_settings():
        return TenantSettings(ecommerce=stored_settings["ecommerce"])

    # Mock set_ecommerce_settings to store settings
    def mock_set_ecommerce_settings(ecommerce_settings: EcommerceSettings):
        stored_settings["ecommerce"] = ecommerce_settings

    # Replace methods with mocks
    tenant.get_settings = mock_get_settings
    tenant.set_ecommerce_settings = mock_set_ecommerce_settings

    # Mock the query to return this tenant
    mock_db.query.return_value.filter.return_value.first.return_value = tenant
    return tenant


class TestShopifyWebhookAutoSubscription:
    """Tests for automatic Shopify webhook subscription."""

    @pytest.mark.asyncio
    async def test_update_shopify_credentials_calls_auto_subscribe(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that updating Shopify credentials calls auto-subscribe method."""
        # Mock the auto-subscribe method
        with patch.object(tenant_service, '_auto_subscribe_shopify_webhooks', new_callable=AsyncMock) as mock_subscribe:
            mock_subscribe.return_value = None

            tenant_update = TenantUpdate(
                ecommerce_platform="shopify",
                ecommerce_store_url="https://test-store.myshopify.com",
                shopify_client_id="test_client_id",
                shopify_client_secret="test_client_secret",
                shopify_api_version="2024-01",
            )

            result = await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Verify auto-subscribe was called
            mock_subscribe.assert_called_once()
            call_args = mock_subscribe.call_args[0]
            assert call_args[0] == mock_db
            assert call_args[1] == sample_tenant

            # Verify tenant was updated
            assert result is not None

    @pytest.mark.asyncio
    async def test_shopify_credentials_saved_in_settings(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that Shopify credentials are saved correctly in settings."""
        with patch.object(tenant_service, '_auto_subscribe_shopify_webhooks', new_callable=AsyncMock):
            tenant_update = TenantUpdate(
                ecommerce_platform="shopify",
                ecommerce_store_url="https://test-store.myshopify.com",
                shopify_client_id="test_client_id",
                shopify_client_secret="test_client_secret",
            )

            await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Verify settings were saved (set_ecommerce_settings was called)
            settings = sample_tenant.get_settings()
            assert settings.ecommerce is not None
            assert settings.ecommerce.shopify is not None
            assert settings.ecommerce.shopify.client_id == "test_client_id"
            assert settings.ecommerce.shopify.client_secret == "test_client_secret"


class TestWooCommerceWebhookAutoSubscription:
    """Tests for automatic WooCommerce webhook subscription."""

    @pytest.mark.asyncio
    async def test_update_woocommerce_credentials_calls_auto_subscribe(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that updating WooCommerce credentials calls auto-subscribe method."""
        with patch.object(tenant_service, '_auto_subscribe_woocommerce_webhooks', new_callable=AsyncMock) as mock_subscribe:
            mock_subscribe.return_value = None

            tenant_update = TenantUpdate(
                ecommerce_platform="woocommerce",
                ecommerce_store_url="https://test-store.com",
                ecommerce_consumer_key="ck_test_key",
                ecommerce_consumer_secret="cs_test_secret",
            )

            result = await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Verify auto-subscribe was called
            mock_subscribe.assert_called_once()
            call_args = mock_subscribe.call_args[0]
            assert call_args[0] == mock_db
            assert call_args[1] == sample_tenant

            # Verify tenant was updated
            assert result is not None

    @pytest.mark.asyncio
    async def test_woocommerce_generates_webhook_secret_automatically(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that webhook_secret is auto-generated for WooCommerce."""
        with patch.object(tenant_service, '_auto_subscribe_woocommerce_webhooks', new_callable=AsyncMock):
            tenant_update = TenantUpdate(
                ecommerce_platform="woocommerce",
                ecommerce_store_url="https://test-store.com",
                ecommerce_consumer_key="ck_test_key",
                ecommerce_consumer_secret="cs_test_secret",
                # webhook_secret NOT provided
            )

            await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Verify webhook_secret was generated
            settings = sample_tenant.get_settings()
            assert settings.ecommerce.woocommerce is not None
            assert settings.ecommerce.woocommerce.webhook_secret is not None
            assert len(settings.ecommerce.woocommerce.webhook_secret) >= 32

    @pytest.mark.asyncio
    async def test_woocommerce_webhook_secret_persists_on_update(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that webhook_secret is preserved when updating other fields."""
        # Set initial settings with webhook_secret
        initial_secret = "existing_webhook_secret_12345"
        sample_tenant.set_ecommerce_settings(EcommerceSettings(
            woocommerce=WooCommerceCredentials(
                store_url="https://old-store.com",
                consumer_key="old_key",
                consumer_secret="old_secret",
                webhook_secret=initial_secret,
            )
        ))

        with patch.object(tenant_service, '_auto_subscribe_woocommerce_webhooks', new_callable=AsyncMock):
            # Update only store_url
            tenant_update = TenantUpdate(
                ecommerce_platform="woocommerce",
                ecommerce_store_url="https://new-store.com",
            )

            await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Verify webhook_secret was preserved
            settings = sample_tenant.get_settings()
            assert settings.ecommerce.woocommerce.webhook_secret == initial_secret


class TestWebhookSecretGeneration:
    """Tests for webhook_secret generation logic."""

    @pytest.mark.asyncio
    async def test_woo_secret_generation_uses_secure_token(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that generated webhook_secret is a secure random token."""
        with patch.object(tenant_service, '_auto_subscribe_woocommerce_webhooks', new_callable=AsyncMock):
            tenant_update = TenantUpdate(
                ecommerce_platform="woocommerce",
                ecommerce_store_url="https://test-store.com",
                ecommerce_consumer_key="ck_test_key",
                ecommerce_consumer_secret="cs_test_secret",
            )

            await tenant_service.update_tenant(mock_db, 1, tenant_update)

            settings = sample_tenant.get_settings()
            webhook_secret = settings.ecommerce.woocommerce.webhook_secret

            # Verify it's a URL-safe base64 string (from secrets.token_urlsafe)
            assert isinstance(webhook_secret, str)
            assert len(webhook_secret) > 0
            # URL-safe base64 uses alphanumeric, -, and _
            import re
            assert re.match(r'^[A-Za-z0-9_-]+$', webhook_secret)

    @pytest.mark.asyncio
    async def test_multiple_tenants_get_different_secrets(
        self, tenant_service, mock_db
    ):
        """Test that different tenants get different webhook secrets."""
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings

        with patch.object(tenant_service, '_auto_subscribe_woocommerce_webhooks', new_callable=AsyncMock):
            secrets = []

            for i in range(3):
                # Create tenant with mock methods
                tenant = Tenant(
                    id=i + 1,
                    name=f"Test Company {i}",
                    slug=f"test-company-{i}-outlet",
                    company_id=f"TEST00{i}",
                    is_active=True,
                    is_platform=False,
                )

                # Add mock methods to each tenant
                stored_settings = {"ecommerce": None}

                def mock_get_settings():
                    return TenantSettings(ecommerce=stored_settings["ecommerce"])

                def mock_set_ecommerce_settings(ecommerce_settings: EcommerceSettings):
                    stored_settings["ecommerce"] = ecommerce_settings

                tenant.get_settings = mock_get_settings
                tenant.set_ecommerce_settings = mock_set_ecommerce_settings

                mock_db.query.return_value.filter.return_value.first.return_value = tenant

                tenant_update = TenantUpdate(
                    ecommerce_platform="woocommerce",
                    ecommerce_store_url=f"https://test-store-{i}.com",
                    ecommerce_consumer_key=f"ck_test_key_{i}",
                    ecommerce_consumer_secret=f"cs_test_secret_{i}",
                )

                await tenant_service.update_tenant(mock_db, i + 1, tenant_update)

                settings = tenant.get_settings()
                secrets.append(settings.ecommerce.woocommerce.webhook_secret)

            # All secrets should be different
            assert len(set(secrets)) == 3, "All webhook secrets should be unique"


class TestCredentialsValidation:
    """Tests for credentials validation before auto-subscription."""

    @pytest.mark.asyncio
    async def test_incomplete_shopify_credentials_still_saves(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that incomplete credentials are saved even without webhook subscription."""
        # Mock to track if auto-subscribe was called
        with patch.object(tenant_service, '_auto_subscribe_shopify_webhooks', new_callable=AsyncMock) as mock_subscribe:
            tenant_update = TenantUpdate(
                ecommerce_platform="shopify",
                ecommerce_store_url="https://test-store.myshopify.com",
                shopify_client_id="test_client_id",
                # Missing client_secret
            )

            result = await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Tenant should be updated
            assert result is not None
            mock_db.commit.assert_called()

            # Auto-subscribe should still be called (it decides to skip internally)
            mock_subscribe.assert_called_once()

    @pytest.mark.asyncio
    async def test_incomplete_woocommerce_credentials_still_saves(
        self, tenant_service, mock_db, sample_tenant
    ):
        """Test that incomplete credentials are saved even without webhook subscription."""
        with patch.object(tenant_service, '_auto_subscribe_woocommerce_webhooks', new_callable=AsyncMock) as mock_subscribe:
            tenant_update = TenantUpdate(
                ecommerce_platform="woocommerce",
                ecommerce_store_url="https://test-store.com",
                ecommerce_consumer_key="ck_test_key",
                # Missing consumer_secret
            )

            result = await tenant_service.update_tenant(mock_db, 1, tenant_update)

            # Tenant should be updated
            assert result is not None
            mock_db.commit.assert_called()

            # Auto-subscribe should still be called
            mock_subscribe.assert_called_once()
