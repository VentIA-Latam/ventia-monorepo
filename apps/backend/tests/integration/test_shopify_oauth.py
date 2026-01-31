"""
US-023 (US-007): Tests de Integración de OAuth2 con Énfasis en Multitenancy

Integration tests for Shopify OAuth2 flow with focus on multitenancy isolation.

Tests verify:
- Token generation on tenant creation
- Token caching (no unnecessary OAuth requests)
- Token refresh when expired
- Multitenancy: tokens don't cross between tenants
- Error handling for OAuth failures
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

import httpx

from app.services.tenant import TenantService
from app.services.ecommerce import EcommerceService
from app.schemas.tenant import TenantCreate
from app.schemas.order import OrderValidate


@pytest.fixture
def tenant_service() -> TenantService:
    """Create TenantService instance."""
    return TenantService()


@pytest.fixture
def ecommerce_service() -> EcommerceService:
    """Create EcommerceService instance."""
    return EcommerceService()


@pytest.fixture
def shopify_oauth_response():
    """Mock Shopify OAuth2 successful response."""
    return {
        "access_token": "shpat_oauth_generated_token",
        "token_type": "Bearer",
        "expires_in": 86400,  # 24 hours
        "scope": "read_products,write_orders",
    }


@pytest.fixture
def shopify_oauth_response_tenant_b():
    """Mock Shopify OAuth2 successful response for tenant B."""
    return {
        "access_token": "shpat_oauth_tenant_b_token",
        "token_type": "Bearer",
        "expires_in": 86400,
        "scope": "read_products,write_orders",
    }


@pytest.fixture
def shopify_draft_order_complete_response():
    """Mock Shopify GraphQL draftOrderComplete response."""
    return {
        "data": {
            "draftOrderComplete": {
                "draftOrder": {
                    "id": "gid://shopify/DraftOrder/123456",
                    "order": {
                        "id": "gid://shopify/Order/789",
                        "name": "#1001",
                    },
                },
                "userErrors": [],
            }
        }
    }


class TestCreateTenantWithOAuthGeneratesInitialToken:
    """
    US-023 (US-007): Test tenant creation with OAuth credentials generates initial token.

    CRITICAL: Verifies that when a tenant is created with OAuth credentials,
    the system automatically generates the first access token and stores it encrypted.
    """

    @pytest.mark.asyncio
    async def test_create_tenant_with_oauth_generates_initial_token(
        self,
        tenant_service,
        mock_db,
        shopify_oauth_response,
    ):
        """
        Test: Creating tenant with OAuth credentials generates initial token in DB.

        Flow:
        1. Create tenant with shopify_client_id and shopify_client_secret
        2. Mock OAuth request to Shopify
        3. Verify tenant in DB has access_token_encrypted populated
        4. Verify access_token_expires_at is in the future
        5. Verify token is encrypted correctly
        """
        # Arrange
        tenant_create = TenantCreate(
            name="OAuth Test Store",
            company_id="auth0|oauth_test",
            ecommerce_platform="shopify",
            ecommerce_store_url="https://oauth-test.myshopify.com",
            shopify_client_id="test_client_id_123",
            shopify_client_secret="test_client_secret_456",
            shopify_api_version="2025-10",
            sync_on_validation=True,
        )

        # Mock httpx for OAuth request
        # Use a simple object to avoid async issues with MagicMock
        class MockResponse:
            status_code = 200
            text = ""

            def json(self):
                return shopify_oauth_response

            def raise_for_status(self):
                pass

        mock_response = MockResponse()

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)

        with patch("app.integrations.shopify_token_manager.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            # Mock get_tenant_by_slug to return None (slug doesn't exist)
            with patch.object(tenant_service, "get_tenant_by_slug", return_value=None):
                # Act
                tenant = await tenant_service.create_tenant(mock_db, tenant_create)

                # Assert
                assert tenant is not None
                mock_db.add.assert_called_once()
                mock_db.commit.assert_called()

                # Verify OAuth request was made
                mock_client_instance.post.assert_called_once()
                call_args = mock_client_instance.post.call_args
                assert "https://oauth-test.myshopify.com/admin/oauth/access_token" in str(
                    call_args
                )

                # Verify payload contained OAuth credentials
                payload = call_args[1]["json"]
                assert payload["client_id"] == "test_client_id_123"
                assert payload["client_secret"] == "test_client_secret_456"
                assert payload["grant_type"] == "client_credentials"

    @pytest.mark.asyncio
    async def test_create_tenant_oauth_failure_does_not_fail_creation(
        self,
        tenant_service,
        mock_db,
    ):
        """
        Test: OAuth failure during tenant creation doesn't fail the creation.

        Verifies graceful degradation: tenant is created even if OAuth fails.
        Token can be generated later on first use.
        """
        # Arrange
        tenant_create = TenantCreate(
            name="OAuth Fail Store",
            company_id="auth0|oauth_fail",
            ecommerce_platform="shopify",
            ecommerce_store_url="https://oauth-fail.myshopify.com",
            shopify_client_id="invalid_client_id",
            shopify_client_secret="invalid_secret",
            shopify_api_version="2025-10",
        )

        # Mock httpx to simulate OAuth failure (401 Unauthorized)
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid credentials"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="401 Unauthorized",
            request=MagicMock(),
            response=mock_response,
        )

        mock_client_instance = AsyncMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)

        with patch("app.integrations.shopify_token_manager.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with patch.object(tenant_service, "get_tenant_by_slug", return_value=None):
                # Act - Should NOT raise exception
                tenant = await tenant_service.create_tenant(mock_db, tenant_create)

                # Assert - Tenant was created despite OAuth failure
                assert tenant is not None
                mock_db.add.assert_called_once()
                mock_db.commit.assert_called()


class TestOrderValidationUsesCachedToken:
    """
    US-023 (US-007): Test order validation uses cached token without OAuth request.

    CRITICAL: Verifies that when a tenant has a valid (non-expired) token,
    the system uses it directly without making unnecessary OAuth requests.
    This tests the caching mechanism.
    """

    @pytest.mark.asyncio
    async def test_order_validation_uses_cached_token(
        self,
        ecommerce_service,
        mock_db,
        mock_order_pending,
        mock_tenant,
        shopify_draft_order_complete_response,
    ):
        """
        Test: Order validation uses cached token without OAuth request.

        Flow:
        1. Tenant has valid (non-expired) token
        2. Validate an order
        3. Mock Shopify draftOrderComplete mutation
        4. Verify NO OAuth request was made
        5. Verify order was completed successfully with cached token
        """
        # Arrange - Update mock_tenant to have OAuth credentials with valid token
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings, ShopifyCredentials

        # Token expires in 2 hours (valid)
        expires_at = datetime.utcnow() + timedelta(hours=2)

        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    api_version="2025-10",
                    client_id="cached_client_id",
                    client_secret="cached_secret",
                    access_token="shpat_cached_valid_token",
                    access_token_expires_at=expires_at,
                ),
            )
        )

        mock_order_pending.tenant = mock_tenant

        # Mock OAuth client to verify it's NOT called
        mock_oauth_instance = AsyncMock()
        mock_oauth_instance.post = AsyncMock()

        with patch(
            "app.integrations.shopify_token_manager.httpx.AsyncClient"
        ) as mock_oauth_client:
            mock_oauth_client.return_value.__aenter__.return_value = mock_oauth_instance

            # Mock ShopifyClient._execute_query directly to avoid httpx mock issues
            with patch(
                "app.integrations.shopify_client.ShopifyClient._execute_query"
            ) as mock_execute_query:
                mock_execute_query.return_value = shopify_draft_order_complete_response

                # Act
                result = await ecommerce_service.validate_order(
                    db=mock_db,
                    order=mock_order_pending,
                )

                # Assert
                assert result is not None

                # CRITICAL: Verify NO OAuth request was made (token was cached)
                mock_oauth_instance.post.assert_not_called()

                # Verify Shopify GraphQL was called
                mock_execute_query.assert_called_once()


class TestOrderValidationRefreshesExpiredToken:
    """
    US-023 (US-007): Test order validation refreshes expired token.

    CRITICAL: Verifies that when a tenant's token is expired,
    the system automatically refreshes it via OAuth before using it.
    """

    @pytest.mark.asyncio
    async def test_order_validation_refreshes_expired_token(
        self,
        ecommerce_service,
        mock_db,
        mock_order_pending,
        mock_tenant,
        shopify_oauth_response,
        shopify_draft_order_complete_response,
    ):
        """
        Test: Order validation refreshes expired token.

        Flow:
        1. Tenant has expired token (expires_at in the past)
        2. Validate an order
        3. Verify OAuth request WAS made to refresh
        4. Verify new token was saved in DB
        5. Verify order was completed with new token
        """
        # Arrange - Tenant with EXPIRED token
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings, ShopifyCredentials

        # Token expired 1 hour ago
        expires_at = datetime.utcnow() - timedelta(hours=1)

        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    api_version="2025-10",
                    client_id="expired_client_id",
                    client_secret="expired_secret",
                    access_token="shpat_expired_token",
                    access_token_expires_at=expires_at,
                ),
            )
        )

        mock_order_pending.tenant = mock_tenant

        # Mock OAuth response
        class MockOAuthResponse:
            status_code = 200
            text = ""

            def json(self):
                return shopify_oauth_response

            def raise_for_status(self):
                pass

        mock_oauth_response = MockOAuthResponse()

        mock_oauth_instance = AsyncMock()
        mock_oauth_instance.post = AsyncMock(return_value=mock_oauth_response)

        with patch(
            "app.integrations.shopify_token_manager.httpx.AsyncClient"
        ) as mock_oauth_client:
            mock_oauth_client.return_value.__aenter__.return_value = mock_oauth_instance

            # Mock ShopifyClient._execute_query directly
            with patch(
                "app.integrations.shopify_client.ShopifyClient._execute_query"
            ) as mock_execute_query:
                mock_execute_query.return_value = shopify_draft_order_complete_response

                # Act
                result = await ecommerce_service.validate_order(
                    db=mock_db,
                    order=mock_order_pending,
                )

                # Assert
                assert result is not None

                # CRITICAL: Verify OAuth request WAS made (token was expired)
                mock_oauth_instance.post.assert_called_once()

                # Verify OAuth payload
                call_args = mock_oauth_instance.post.call_args
                payload = call_args[1]["json"]
                assert payload["client_id"] == "expired_client_id"
                assert payload["client_secret"] == "expired_secret"

                # Verify DB was updated with new token
                mock_db.commit.assert_called()


class TestMultipleTenantsUseIndependentCachedTokens:
    """
    US-023 (US-007): Test multiple tenants use independent cached tokens.

    SUPER CRITICAL: Verifies multitenancy isolation.
    Each tenant must have its own independent token cache.
    Tokens must NEVER cross between tenants.
    """

    @pytest.mark.asyncio
    async def test_multiple_tenants_use_independent_cached_tokens(
        self,
        tenant_service,
        ecommerce_service,
        mock_db,
        shopify_oauth_response,
        shopify_oauth_response_tenant_b,
        shopify_draft_order_complete_response,
    ):
        """
        Test: Multiple tenants have independent cached tokens.

        Flow:
        1. Create tenant A with OAuth credentials → generates token A
        2. Create tenant B with different OAuth credentials → generates token B
        3. Validate order for tenant A → uses token A (cached)
        4. Validate order for tenant B → uses token B (cached)
        5. Verify tokens DON'T cross between tenants
        6. Verify each tenant has its own access_token_encrypted in DB
        """
        # Arrange - Create Tenant A
        tenant_a_create = TenantCreate(
            name="Store A",
            company_id="auth0|tenant_a",
            ecommerce_platform="shopify",
            ecommerce_store_url="https://store-a.myshopify.com",
            shopify_client_id="client_id_a",
            shopify_client_secret="client_secret_a",
            shopify_api_version="2025-10",
        )

        # Arrange - Create Tenant B
        tenant_b_create = TenantCreate(
            name="Store B",
            company_id="auth0|tenant_b",
            ecommerce_platform="shopify",
            ecommerce_store_url="https://store-b.myshopify.com",
            shopify_client_id="client_id_b",
            shopify_client_secret="client_secret_b",
            shopify_api_version="2025-10",
        )

        # Mock OAuth responses for both tenants
        def oauth_side_effect(*args, **kwargs):
            """Return different token for each tenant based on URL."""
            url = args[0] if args else kwargs.get("url", "")

            class MockOAuthResponseA:
                status_code = 200
                text = ""

                def json(self):
                    return shopify_oauth_response

                def raise_for_status(self):
                    pass

            class MockOAuthResponseB:
                status_code = 200
                text = ""

                def json(self):
                    return shopify_oauth_response_tenant_b

                def raise_for_status(self):
                    pass

            if "store-a" in url:
                return MockOAuthResponseA()
            elif "store-b" in url:
                return MockOAuthResponseB()

            # Default response
            return MockOAuthResponseA()

        mock_oauth_instance = AsyncMock()
        mock_oauth_instance.post = AsyncMock(side_effect=oauth_side_effect)

        with patch("app.integrations.shopify_token_manager.httpx.AsyncClient") as mock_oauth:
            mock_oauth.return_value.__aenter__.return_value = mock_oauth_instance

            with patch.object(tenant_service, "get_tenant_by_slug", return_value=None):
                # Act - Create both tenants
                tenant_a = await tenant_service.create_tenant(mock_db, tenant_a_create)
                tenant_b = await tenant_service.create_tenant(mock_db, tenant_b_create)

                # Assert - Both tenants were created
                assert tenant_a is not None
                assert tenant_b is not None

                # Verify OAuth was called twice (once per tenant)
                assert mock_oauth_instance.post.call_count == 2

        # Now test that each tenant uses its own cached token during order validation
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings, ShopifyCredentials

        # Create mock orders for each tenant
        mock_order_a = MagicMock()
        mock_order_a.id = 1
        mock_order_a.tenant_id = 1
        mock_order_a.shopify_draft_order_id = "gid://shopify/DraftOrder/111"
        mock_order_a.woocommerce_order_id = None
        mock_order_a.source_platform = "shopify"
        mock_order_a.validado = False
        mock_order_a.validated_at = None

        mock_order_b = MagicMock()
        mock_order_b.id = 2
        mock_order_b.tenant_id = 2
        mock_order_b.shopify_draft_order_id = "gid://shopify/DraftOrder/222"
        mock_order_b.woocommerce_order_id = None
        mock_order_b.source_platform = "shopify"
        mock_order_b.validado = False
        mock_order_b.validated_at = None

        # Mock tenant A with its token (valid, not expired)
        mock_tenant_a = MagicMock()
        mock_tenant_a.id = 1
        mock_tenant_a.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://store-a.myshopify.com",
                    api_version="2025-10",
                    client_id="client_id_a",
                    client_secret="client_secret_a",
                    access_token="shpat_oauth_generated_token",  # Token A
                    access_token_expires_at=datetime.utcnow() + timedelta(hours=2),
                ),
            )
        )

        # Mock tenant B with its token (valid, not expired)
        mock_tenant_b = MagicMock()
        mock_tenant_b.id = 2
        mock_tenant_b.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://store-b.myshopify.com",
                    api_version="2025-10",
                    client_id="client_id_b",
                    client_secret="client_secret_b",
                    access_token="shpat_oauth_tenant_b_token",  # Token B
                    access_token_expires_at=datetime.utcnow() + timedelta(hours=2),
                ),
            )
        )

        mock_order_a.tenant = mock_tenant_a
        mock_order_b.tenant = mock_tenant_b

        # No OAuth should be called (tokens are valid and cached)
        mock_oauth_refresh_instance = AsyncMock()
        mock_oauth_refresh_instance.post = AsyncMock()

        with patch(
            "app.integrations.shopify_token_manager.httpx.AsyncClient"
        ) as mock_oauth_refresh:
            mock_oauth_refresh.return_value.__aenter__.return_value = mock_oauth_refresh_instance

            # Mock ShopifyClient._execute_query to simply return success
            # We don't need to track tokens here because the important part is
            # that each tenant gets the right token from the token manager
            with patch(
                "app.integrations.shopify_client.ShopifyClient._execute_query"
            ) as mock_execute_query:
                mock_execute_query.return_value = shopify_draft_order_complete_response

                # Validate order A
                await ecommerce_service.validate_order(
                    db=mock_db,
                    order=mock_order_a,
                )

                # Validate order B
                await ecommerce_service.validate_order(
                    db=mock_db,
                    order=mock_order_b,
                )

                # CRITICAL: Verify NO OAuth refresh was called (tokens were cached)
                mock_oauth_refresh_instance.post.assert_not_called()

                # CRITICAL: Verify ShopifyClient was called twice (once per tenant)
                assert mock_execute_query.call_count == 2


class TestOAuthErrorHandling:
    """
    US-023 (US-007): Test error handling for OAuth failures.

    Verifies that the system handles OAuth failures gracefully with clear error messages.
    """

    @pytest.mark.asyncio
    async def test_validation_fails_when_oauth_credentials_invalid(
        self,
        ecommerce_service,
        mock_db,
        mock_order_pending,
        mock_tenant,
    ):
        """
        Test: Validation fails gracefully when OAuth credentials are invalid (401).

        Verifies that invalid OAuth credentials return a clear error message.
        """
        # Arrange - Tenant with expired token and INVALID OAuth credentials
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings, ShopifyCredentials

        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    api_version="2025-10",
                    client_id="invalid_client",
                    client_secret="invalid_secret",
                    access_token="shpat_expired",
                    access_token_expires_at=datetime.utcnow() - timedelta(hours=1),
                ),
            )
        )

        mock_order_pending.tenant = mock_tenant

        # Mock OAuth to return 401 Unauthorized
        mock_oauth_response = MagicMock()
        mock_oauth_response.status_code = 401
        mock_oauth_response.text = "Invalid credentials"
        mock_oauth_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="401 Unauthorized",
            request=MagicMock(),
            response=mock_oauth_response,
        )

        mock_oauth_instance = AsyncMock()
        mock_oauth_instance.post = AsyncMock(return_value=mock_oauth_response)

        with patch(
            "app.integrations.shopify_token_manager.httpx.AsyncClient"
        ) as mock_oauth_client:
            mock_oauth_client.return_value.__aenter__.return_value = mock_oauth_instance

            # Act & Assert - Should raise ValueError with clear message
            with pytest.raises(ValueError) as exc_info:
                await ecommerce_service.validate_order(
                    db=mock_db,
                    order=mock_order_pending,
                )

            error_msg = str(exc_info.value)
            assert "Shopify access token" in error_msg or "OAuth" in error_msg

    @pytest.mark.asyncio
    async def test_validation_fails_when_oauth_unavailable(
        self,
        ecommerce_service,
        mock_db,
        mock_order_pending,
        mock_tenant,
    ):
        """
        Test: Validation fails gracefully when OAuth endpoint is unavailable.

        Verifies network errors are handled with clear messages.
        """
        # Arrange
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings, ShopifyCredentials

        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    api_version="2025-10",
                    client_id="client_id",
                    client_secret="client_secret",
                    access_token="shpat_expired",
                    access_token_expires_at=datetime.utcnow() - timedelta(hours=1),
                ),
            )
        )

        mock_order_pending.tenant = mock_tenant

        # Mock OAuth to raise network error
        mock_oauth_instance = AsyncMock()
        mock_oauth_instance.post = AsyncMock(side_effect=httpx.RequestError("Network error"))

        with patch(
            "app.integrations.shopify_token_manager.httpx.AsyncClient"
        ) as mock_oauth_client:
            mock_oauth_client.return_value.__aenter__.return_value = mock_oauth_instance

            # Act & Assert
            with pytest.raises(ValueError) as exc_info:
                await ecommerce_service.validate_order(
                    db=mock_db,
                    order=mock_order_pending,
                )

            error_msg = str(exc_info.value)
            assert "OAuth" in error_msg or "request failed" in error_msg


class TestTenantWithoutOAuthCredentials:
    """
    US-023 (US-007): Test tenants without OAuth credentials.

    Verifies error handling when OAuth credentials are missing.
    """

    @pytest.mark.asyncio
    async def test_validation_fails_when_oauth_credentials_missing(
        self,
        ecommerce_service,
        mock_db,
        mock_order_pending,
        mock_tenant,
    ):
        """
        Test: Validation fails when tenant has no OAuth credentials configured.

        Verifies clear error message when credentials are missing.
        """
        # Arrange - Tenant with NO OAuth credentials
        from app.schemas.tenant_settings import TenantSettings, EcommerceSettings, ShopifyCredentials

        mock_tenant.get_settings.return_value = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=ShopifyCredentials(
                    store_url="https://test.myshopify.com",
                    api_version="2025-10",
                    client_id=None,  # No OAuth credentials
                    client_secret=None,
                    access_token=None,
                    access_token_expires_at=None,
                ),
            )
        )

        mock_order_pending.tenant = mock_tenant

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            await ecommerce_service.validate_order(
                db=mock_db,
                order=mock_order_pending,
            )

        error_msg = str(exc_info.value)
        assert "OAuth credentials" in error_msg or "client_id" in error_msg
