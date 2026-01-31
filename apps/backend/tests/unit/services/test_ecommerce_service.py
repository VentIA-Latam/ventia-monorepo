"""
US-003: Tests de Coherencia de Plataforma E-commerce

Tests for EcommerceService platform coherence validations.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock

from app.services.ecommerce import EcommerceService
from app.schemas.tenant_settings import (
    TenantSettings,
    EcommerceSettings,
    ShopifyCredentials,
    WooCommerceCredentials,
)


class TestEcommerceServicePlatformCoherence:
    """Tests for platform coherence validations in EcommerceService."""

    @pytest.fixture
    def ecommerce_service(self) -> EcommerceService:
        """Create EcommerceService instance."""
        return EcommerceService()

    @pytest.fixture
    def mock_order_shopify(self, mock_tenant):
        """Create order with Shopify source."""
        order = MagicMock()
        order.id = 1
        order.tenant_id = 1
        order.tenant = mock_tenant
        order.shopify_draft_order_id = "gid://shopify/DraftOrder/123"
        order.woocommerce_order_id = None
        order.validado = False
        order.validated_at = None
        order.source_platform = "shopify"
        return order

    @pytest.fixture
    def mock_order_woocommerce(self, mock_tenant_woocommerce):
        """Create order with WooCommerce source."""
        order = MagicMock()
        order.id = 2
        order.tenant_id = 2
        order.tenant = mock_tenant_woocommerce
        order.shopify_draft_order_id = None
        order.woocommerce_order_id = 456
        order.validado = False
        order.validated_at = None
        order.source_platform = "woocommerce"
        return order

    @pytest.fixture
    def mock_order_no_platform(self, mock_tenant):
        """Create order without any platform ID."""
        order = MagicMock()
        order.id = 3
        order.tenant_id = 1
        order.tenant = mock_tenant
        order.shopify_draft_order_id = None
        order.woocommerce_order_id = None
        order.validado = False
        order.validated_at = None
        order.source_platform = None
        return order

    # ========================================
    # Shopify Platform Coherence
    # ========================================

    @pytest.mark.asyncio
    async def test_shopify_platform_requires_shopify_order_id(
        self, ecommerce_service, mock_db, mock_order_no_platform, mock_tenant
    ):
        """Test: Tenant with platform=shopify and order without shopify_draft_order_id fails."""
        # Configure tenant for Shopify
        mock_order_no_platform.tenant = mock_tenant
        mock_order_no_platform.source_platform = None

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_no_platform,
            )

        error_msg = str(exc_info.value)
        assert "Shopify" in error_msg
        assert "shopify_draft_order_id" in error_msg

    @pytest.mark.asyncio
    async def test_shopify_order_with_woocommerce_tenant_fails(
        self, ecommerce_service, mock_db, mock_order_shopify, mock_tenant_woocommerce
    ):
        """Test: Shopify order with WooCommerce-configured tenant fails."""
        mock_order_shopify.tenant = mock_tenant_woocommerce
        mock_order_shopify.source_platform = "shopify"

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_shopify,
            )

        error_msg = str(exc_info.value)
        assert "WooCommerce" in error_msg

    # ========================================
    # WooCommerce Platform Coherence
    # ========================================

    @pytest.mark.asyncio
    async def test_woocommerce_platform_requires_woocommerce_order_id(
        self, ecommerce_service, mock_db, mock_tenant_woocommerce
    ):
        """Test: Tenant with platform=woocommerce and order without woocommerce_order_id fails."""
        order = MagicMock()
        order.id = 1
        order.tenant = mock_tenant_woocommerce
        order.validado = False
        order.shopify_draft_order_id = None
        order.woocommerce_order_id = None
        order.source_platform = None

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=order,
            )

        error_msg = str(exc_info.value)
        assert "WooCommerce" in error_msg
        assert "woocommerce_order_id" in error_msg

    @pytest.mark.asyncio
    async def test_woocommerce_order_with_shopify_tenant_fails(
        self, ecommerce_service, mock_db, mock_order_woocommerce, mock_tenant
    ):
        """Test: WooCommerce order with Shopify-configured tenant fails."""
        mock_order_woocommerce.tenant = mock_tenant
        mock_order_woocommerce.source_platform = "woocommerce"

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_woocommerce,
            )

        error_msg = str(exc_info.value)
        assert "Shopify" in error_msg

    # ========================================
    # Already Validated Orders
    # ========================================

    @pytest.mark.asyncio
    async def test_already_validated_order_raises_error(
        self, ecommerce_service, mock_db, mock_order_shopify
    ):
        """Test: Order with validado=True cannot be validated again."""
        mock_order_shopify.validado = True
        mock_order_shopify.validated_at = datetime.utcnow()

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_shopify,
            )

        error_msg = str(exc_info.value)
        assert "already been validated" in error_msg

    # ========================================
    # Successful Validation Without Sync
    # ========================================

    @pytest.mark.asyncio
    async def test_validation_without_sync_updates_local_only(
        self, ecommerce_service, mock_db, mock_tenant
    ):
        """Test: Validation with sync_on_validation=False works without external calls."""
        # Configure tenant without sync
        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=False,  # Disabled
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    access_token="shpat_test",
                ),
            )
        )

        order = MagicMock()
        order.id = 1
        order.tenant = mock_tenant
        order.validado = False
        order.shopify_draft_order_id = "gid://shopify/DraftOrder/123"
        order.source_platform = "shopify"

        with patch("app.services.ecommerce.order_repository") as mock_repo:
            mock_repo.update.return_value = order

            result = await ecommerce_service.validate_order(
                db=mock_db,
                order=order,
            )

            # Should update order locally
            mock_repo.update.assert_called_once()
            update_call = mock_repo.update.call_args

            # Check update data
            update_data = update_call.kwargs.get("obj_in", update_call[1].get("obj_in", {}))
            assert update_data.get("validado") is True
            assert update_data.get("status") == "Pagado"
            assert "validated_at" in update_data

    # ========================================
    # Successful Validation With State Update
    # ========================================

    @pytest.mark.asyncio
    async def test_validation_updates_state_correctly(
        self, ecommerce_service, mock_db, mock_order_shopify, mock_tenant
    ):
        """Test: Validation updates validado=True, status='Pagado', validated_at."""
        mock_order_shopify.tenant = mock_tenant

        # Mock Shopify client success
        with patch("app.services.ecommerce.order_repository") as mock_repo, \
             patch.object(ecommerce_service, "_sync_shopify", new_callable=AsyncMock) as mock_sync:

            mock_sync.return_value = "gid://shopify/Order/789"
            mock_repo.update.return_value = mock_order_shopify

            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_shopify,
            )

            # Verify update was called with correct data
            mock_repo.update.assert_called_once()
            update_call = mock_repo.update.call_args
            update_data = update_call.kwargs.get("obj_in", update_call[1].get("obj_in", {}))

            assert update_data.get("validado") is True
            assert update_data.get("status") == "Pagado"
            assert "validated_at" in update_data
            assert update_data.get("shopify_order_id") == "gid://shopify/Order/789"

    # ========================================
    # Missing Credentials
    # ========================================

    @pytest.mark.asyncio
    async def test_shopify_without_access_token_raises_error(
        self, ecommerce_service, mock_db, mock_order_shopify, mock_tenant
    ):
        """Test: Shopify validation without access_token raises error."""
        # Configure tenant with missing token
        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    access_token=None,  # Missing
                ),
            )
        )
        mock_order_shopify.tenant = mock_tenant

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_shopify,
            )

        assert "access token" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_woocommerce_without_credentials_raises_error(
        self, ecommerce_service, mock_db, mock_order_woocommerce, mock_tenant_woocommerce
    ):
        """Test: WooCommerce validation without credentials raises error."""
        # Configure tenant with missing credentials
        mock_tenant_woocommerce.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                woocommerce=WooCommerceCredentials(
                    store_url="https://test-woo.com",
                    consumer_key=None,  # Missing
                    consumer_secret=None,  # Missing
                ),
            )
        )
        mock_order_woocommerce.tenant = mock_tenant_woocommerce

        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_woocommerce,
            )

        assert "credentials" in str(exc_info.value).lower()

    # ========================================
    # Tenant Without E-commerce
    # ========================================

    @pytest.mark.asyncio
    async def test_tenant_without_ecommerce_validates_locally(
        self, ecommerce_service, mock_db
    ):
        """Test: Tenant without e-commerce config validates order locally."""
        tenant = MagicMock()
        tenant.id = 1
        tenant.get_settings.return_value = TenantSettings(
            ecommerce=None  # No e-commerce configured
        )

        order = MagicMock()
        order.id = 1
        order.tenant = tenant
        order.validado = False

        with patch("app.services.ecommerce.order_repository") as mock_repo:
            mock_repo.update.return_value = order

            await ecommerce_service.validate_order(
                db=mock_db,
                order=order,
            )

            mock_repo.update.assert_called_once()
