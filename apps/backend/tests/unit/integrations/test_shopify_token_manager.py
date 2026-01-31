"""
US-022: Unit Tests for ShopifyTokenManager

Tests OAuth2 token management with emphasis on caching per tenant.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.integrations.shopify_token_manager import ShopifyTokenManager
from app.schemas.tenant_settings import EcommerceSettings, ShopifyCredentials, TenantSettings


class TestTokenValidation:
    """Tests for token validation and caching logic."""

    @pytest.fixture
    def token_manager(self) -> ShopifyTokenManager:
        """Create ShopifyTokenManager instance."""
        return ShopifyTokenManager()

    @pytest.fixture
    def mock_tenant_with_valid_token(self):
        """Create a mock tenant with a valid (non-expired) token."""
        tenant = MagicMock()
        tenant.id = 1

        # Token expires in 1 hour (valid)
        expires_at = datetime.utcnow() + timedelta(hours=1)

        shopify_creds = ShopifyCredentials(
            store_url="https://test-store.myshopify.com",
            api_version="2025-10",
            client_id="test_client_id",
            client_secret="test_client_secret",
            access_token="shpat_valid_token_123",
            access_token_expires_at=expires_at,
        )

        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )
        )

        tenant.get_settings.return_value = settings
        return tenant

    @pytest.fixture
    def mock_tenant_with_expired_token(self):
        """Create a mock tenant with an expired token."""
        tenant = MagicMock()
        tenant.id = 2

        # Token expired 1 hour ago
        expires_at = datetime.utcnow() - timedelta(hours=1)

        shopify_creds = ShopifyCredentials(
            store_url="https://test-store.myshopify.com",
            api_version="2025-10",
            client_id="test_client_id",
            client_secret="test_client_secret",
            access_token="shpat_expired_token_456",
            access_token_expires_at=expires_at,
        )

        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )
        )

        tenant.get_settings.return_value = settings
        return tenant

    @pytest.fixture
    def mock_tenant_with_soon_expiring_token(self):
        """Create a mock tenant with a token expiring in 3 minutes."""
        tenant = MagicMock()
        tenant.id = 3

        # Token expires in 3 minutes (within the 5-minute buffer)
        expires_at = datetime.utcnow() + timedelta(minutes=3)

        shopify_creds = ShopifyCredentials(
            store_url="https://test-store.myshopify.com",
            api_version="2025-10",
            client_id="test_client_id",
            client_secret="test_client_secret",
            access_token="shpat_soon_expired_789",
            access_token_expires_at=expires_at,
        )

        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )
        )

        tenant.get_settings.return_value = settings
        return tenant

    @pytest.fixture
    def mock_tenant_without_token(self):
        """Create a mock tenant without an access token."""
        tenant = MagicMock()
        tenant.id = 4

        shopify_creds = ShopifyCredentials(
            store_url="https://test-store.myshopify.com",
            api_version="2025-10",
            client_id="test_client_id",
            client_secret="test_client_secret",
            access_token=None,
            access_token_expires_at=None,
        )

        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )
        )

        tenant.get_settings.return_value = settings
        return tenant

    @pytest.mark.asyncio
    async def test_token_valid_returns_cached_token_without_refresh(
        self, token_manager, mock_tenant_with_valid_token, mock_db
    ):
        """
        TEST CRÍTICO: Token válido se devuelve del caché sin hacer HTTP request.

        Este es el test más importante para garantizar el funcionamiento del caché.
        """
        with patch("httpx.AsyncClient") as mock_client:
            # This mock should NEVER be called
            mock_client.return_value.__aenter__.return_value.post = AsyncMock()

            result = await token_manager.get_valid_access_token(
                db=mock_db,
                tenant=mock_tenant_with_valid_token,
            )

            # Should return the cached token
            assert result == "shpat_valid_token_123"

            # HTTP client should NOT have been created or called
            mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_token_expired_triggers_refresh(
        self, token_manager, mock_tenant_with_expired_token, mock_db
    ):
        """TEST CRÍTICO: Token expirado dispara renovación automática."""
        with patch("httpx.AsyncClient") as mock_client:
            # Mock successful OAuth response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "access_token": "shpat_new_token_999",
                "expires_in": 86400,  # 24 hours
            }
            mock_response.raise_for_status = MagicMock()

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await token_manager.get_valid_access_token(
                db=mock_db,
                tenant=mock_tenant_with_expired_token,
            )

            # Should return the new token
            assert result == "shpat_new_token_999"

            # HTTP client MUST have been called to refresh
            mock_client.assert_called_once()
            mock_post.assert_called_once()

            # Verify correct OAuth endpoint was called
            call_args = mock_post.call_args
            assert "admin/oauth/access_token" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_token_expires_soon_triggers_refresh(
        self, token_manager, mock_tenant_with_soon_expiring_token, mock_db
    ):
        """
        TEST CRÍTICO: Token que expira pronto (dentro del buffer de 5 min) dispara renovación.
        """
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "access_token": "shpat_renewed_early",
                "expires_in": 86400,
            }
            mock_response.raise_for_status = MagicMock()

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await token_manager.get_valid_access_token(
                db=mock_db,
                tenant=mock_tenant_with_soon_expiring_token,
            )

            # Should proactively refresh and return new token
            assert result == "shpat_renewed_early"

            # HTTP client MUST have been called
            mock_client.assert_called_once()

    @pytest.mark.asyncio
    async def test_missing_token_triggers_generation(
        self, token_manager, mock_tenant_without_token, mock_db
    ):
        """Test: Tenant sin token genera uno nuevo."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "access_token": "shpat_first_token",
                "expires_in": 86400,
            }
            mock_response.raise_for_status = MagicMock()

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            result = await token_manager.get_valid_access_token(
                db=mock_db,
                tenant=mock_tenant_without_token,
            )

            assert result == "shpat_first_token"
            mock_client.assert_called_once()

    @pytest.mark.asyncio
    async def test_missing_oauth_credentials_raises_error(
        self, token_manager, mock_db
    ):
        """Test: Tenant sin credenciales OAuth lanza ValueError."""
        tenant = MagicMock()
        tenant.id = 5

        # Tenant without OAuth credentials
        shopify_creds = ShopifyCredentials(
            store_url="https://test-store.myshopify.com",
            api_version="2025-10",
            client_id=None,  # Missing
            client_secret=None,  # Missing
            access_token=None,
            access_token_expires_at=None,
        )

        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )
        )

        tenant.get_settings.return_value = settings

        with pytest.raises(ValueError) as exc_info:
            await token_manager.get_valid_access_token(db=mock_db, tenant=tenant)

        assert "OAuth credentials" in str(exc_info.value)
        assert "client_id" in str(exc_info.value)


class TestOAuth2Integration:
    """Tests for OAuth2 token refresh with Shopify."""

    @pytest.fixture
    def token_manager(self) -> ShopifyTokenManager:
        """Create ShopifyTokenManager instance."""
        return ShopifyTokenManager()

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, token_manager):
        """Test: Successful OAuth2 token refresh."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "access_token": "shpat_new_abc123",
                "token_type": "Bearer",
                "expires_in": 86400,
                "scope": "read_products,write_orders",
            }
            mock_response.raise_for_status = MagicMock()

            mock_post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value.post = mock_post

            access_token, expires_in = await token_manager._refresh_token(
                store_url="https://test-store.myshopify.com",
                client_id="test_client",
                client_secret="test_secret",
            )

            assert access_token == "shpat_new_abc123"
            assert expires_in == 86400

            # Verify correct payload
            call_kwargs = mock_post.call_args[1]
            assert call_kwargs["json"]["client_id"] == "test_client"
            assert call_kwargs["json"]["client_secret"] == "test_secret"
            assert call_kwargs["json"]["grant_type"] == "client_credentials"

    @pytest.mark.asyncio
    async def test_refresh_token_http_401_error(self, token_manager):
        """Test: HTTP 401 error from Shopify OAuth (credenciales inválidas)."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 401
            mock_response.text = "Invalid credentials"

            mock_post = AsyncMock(return_value=mock_response)
            mock_post.return_value.raise_for_status.side_effect = httpx.HTTPStatusError(
                "401 Unauthorized",
                request=MagicMock(),
                response=mock_response,
            )

            mock_client.return_value.__aenter__.return_value.post = mock_post

            with pytest.raises(ValueError) as exc_info:
                await token_manager._refresh_token(
                    store_url="https://test-store.myshopify.com",
                    client_id="wrong_client",
                    client_secret="wrong_secret",
                )

            assert "status 401" in str(exc_info.value)
            assert "Invalid credentials" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_refresh_token_http_500_error(self, token_manager):
        """Test: HTTP 500 error from Shopify (error de servidor)."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"

            mock_post = AsyncMock(return_value=mock_response)
            mock_post.return_value.raise_for_status.side_effect = httpx.HTTPStatusError(
                "500 Server Error",
                request=MagicMock(),
                response=mock_response,
            )

            mock_client.return_value.__aenter__.return_value.post = mock_post

            with pytest.raises(ValueError) as exc_info:
                await token_manager._refresh_token(
                    store_url="https://test-store.myshopify.com",
                    client_id="test_client",
                    client_secret="test_secret",
                )

            assert "status 500" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_refresh_token_network_error(self, token_manager):
        """Test: Network error durante OAuth request."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock(
                side_effect=httpx.RequestError("Connection refused")
            )

            mock_client.return_value.__aenter__.return_value.post = mock_post

            with pytest.raises(ValueError) as exc_info:
                await token_manager._refresh_token(
                    store_url="https://test-store.myshopify.com",
                    client_id="test_client",
                    client_secret="test_secret",
                )

            assert "OAuth request failed" in str(exc_info.value)


class TestTokenPersistence:
    """Tests for token storage and encryption in database."""

    @pytest.fixture
    def token_manager(self) -> ShopifyTokenManager:
        """Create ShopifyTokenManager instance."""
        return ShopifyTokenManager()

    def test_update_token_encrypts_and_persists(self, token_manager):
        """
        TEST CRÍTICO: Nuevo token se encripta y persiste correctamente en BD.
        """
        tenant = MagicMock()
        tenant.id = 1

        # Mock current settings
        shopify_creds = ShopifyCredentials(
            store_url="https://test-store.myshopify.com",
            api_version="2025-10",
            client_id="test_client_id",
            client_secret="test_client_secret",
            access_token="old_token",
            access_token_expires_at=datetime.utcnow() - timedelta(hours=1),
        )

        settings = TenantSettings(
            ecommerce=EcommerceSettings(
                sync_on_validation=True,
                shopify=shopify_creds,
            )
        )

        tenant.get_settings.return_value = settings

        # Update with new token
        new_token = "shpat_new_encrypted_token"
        expires_in = 86400  # 24 hours

        token_manager._update_token_in_settings(
            tenant=tenant,
            new_token=new_token,
            expires_in=expires_in,
        )

        # Verify set_ecommerce_settings was called
        tenant.set_ecommerce_settings.assert_called_once()

        # Verify the new token was set
        updated_settings = tenant.set_ecommerce_settings.call_args[0][0]
        assert updated_settings.shopify.access_token == new_token

        # Verify expires_at was calculated correctly (within 1 second tolerance)
        expected_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        actual_expires_at = updated_settings.shopify.access_token_expires_at
        time_diff = abs((actual_expires_at - expected_expires_at).total_seconds())
        assert time_diff < 1, "expires_at should be calculated correctly"

    @pytest.mark.asyncio
    async def test_multiple_tenants_have_independent_tokens(
        self, token_manager, mock_db
    ):
        """
        TEST SÚPER CRÍTICO: Múltiples tenants tienen tokens independientes cacheados.
        """
        # Tenant A with valid token
        tenant_a = MagicMock()
        tenant_a.id = 1

        expires_at_a = datetime.utcnow() + timedelta(hours=2)
        shopify_a = ShopifyCredentials(
            store_url="https://tenant-a.myshopify.com",
            api_version="2025-10",
            client_id="client_a",
            client_secret="secret_a",
            access_token="token_a_cached",
            access_token_expires_at=expires_at_a,
        )
        settings_a = TenantSettings(
            ecommerce=EcommerceSettings(sync_on_validation=True, shopify=shopify_a)
        )
        tenant_a.get_settings.return_value = settings_a

        # Tenant B with valid token
        tenant_b = MagicMock()
        tenant_b.id = 2

        expires_at_b = datetime.utcnow() + timedelta(hours=3)
        shopify_b = ShopifyCredentials(
            store_url="https://tenant-b.myshopify.com",
            api_version="2025-10",
            client_id="client_b",
            client_secret="secret_b",
            access_token="token_b_cached",
            access_token_expires_at=expires_at_b,
        )
        settings_b = TenantSettings(
            ecommerce=EcommerceSettings(sync_on_validation=True, shopify=shopify_b)
        )
        tenant_b.get_settings.return_value = settings_b

        with patch("httpx.AsyncClient") as mock_client:
            # HTTP client should NOT be called (tokens are valid)
            mock_client.return_value.__aenter__.return_value.post = AsyncMock()

            # Get token for tenant A
            token_a = await token_manager.get_valid_access_token(
                db=mock_db, tenant=tenant_a
            )

            # Get token for tenant B
            token_b = await token_manager.get_valid_access_token(
                db=mock_db, tenant=tenant_b
            )

            # Tokens should be different and from cache
            assert token_a == "token_a_cached"
            assert token_b == "token_b_cached"
            assert token_a != token_b

            # No HTTP requests should have been made (both cached)
            mock_client.assert_not_called()
