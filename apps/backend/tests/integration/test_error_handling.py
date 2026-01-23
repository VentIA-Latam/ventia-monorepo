"""
US-011: Tests de Timeouts de Integraciones Externas
US-012: Tests de Respuestas HTTP Invalidas

Integration tests for error handling in external integrations.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, AsyncMock
import json

import httpx

from app.integrations.efact_client import (
    EFactClient,
    EFactError,
    EFactAuthError,
    _token_cache,
)
from app.integrations.shopify_client import ShopifyClient
from app.integrations.woocommerce_client import (
    WooCommerceClient,
    WooCommerceError,
)


class TestIntegrationTimeouts:
    """US-011: Tests for timeout handling in external integrations."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset and set valid token cache for eFact tests."""
        _token_cache["access_token"] = "valid_test_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=10)
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token",
        )

    @pytest.fixture
    def woocommerce_client(self) -> WooCommerceClient:
        """Create WooCommerceClient instance."""
        return WooCommerceClient(
            store_url="https://test-store.com",
            consumer_key="ck_test",
            consumer_secret="cs_test",
        )

    # ========================================
    # US-011: eFact Timeout Tests
    # ========================================

    def test_efact_timeout_raises_efact_error_with_message(self, efact_client):
        """Test: eFact timeout raises EFactError with descriptive message."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = httpx.TimeoutException(
                "Connection timed out after 30 seconds",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            error_msg = str(exc_info.value).lower()
            assert "network error" in error_msg or "timeout" in error_msg

    # ========================================
    # US-011: Shopify Timeout Tests
    # ========================================

    @pytest.mark.asyncio
    async def test_shopify_timeout_raises_timeout_exception(self, shopify_client):
        """Test: Shopify timeout raises TimeoutException."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.side_effect = httpx.TimeoutException(
                "Request timed out",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.TimeoutException):
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )

    # ========================================
    # US-011: WooCommerce Timeout Tests
    # ========================================

    @pytest.mark.asyncio
    async def test_woocommerce_timeout_raises_request_error(self, woocommerce_client):
        """Test: WooCommerce timeout raises RequestError."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.side_effect = httpx.TimeoutException(
                "Request timed out",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.RequestError):
                await woocommerce_client.mark_order_as_paid(123)

    # ========================================
    # US-011: Connection Error Tests
    # ========================================

    def test_efact_connection_refused_raises_error(self, efact_client):
        """Test: Connection refused raises EFactError."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = httpx.ConnectError(
                "Connection refused",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            assert "Network error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_shopify_connection_refused_raises_connect_error(
        self, shopify_client
    ):
        """Test: Shopify connection refused raises ConnectError."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.side_effect = httpx.ConnectError(
                "Connection refused",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.ConnectError):
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )

    @pytest.mark.asyncio
    async def test_woocommerce_connection_refused_raises_connect_error(
        self, woocommerce_client
    ):
        """Test: WooCommerce connection refused raises ConnectError."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.side_effect = httpx.ConnectError(
                "Connection refused",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.ConnectError):
                await woocommerce_client.mark_order_as_paid(123)

    # ========================================
    # US-011: DNS Resolution Failure Tests
    # ========================================

    def test_efact_dns_failure_raises_error(self, efact_client):
        """Test: DNS resolution failure raises EFactError."""
        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.side_effect = httpx.ConnectError(
                "Name or service not known",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            assert "Network error" in str(exc_info.value)


class TestInvalidResponses:
    """US-012: Tests for invalid HTTP response handling."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset and set valid token cache for eFact tests."""
        _token_cache["access_token"] = "valid_test_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=10)
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token",
        )

    @pytest.fixture
    def woocommerce_client(self) -> WooCommerceClient:
        """Create WooCommerceClient instance."""
        return WooCommerceClient(
            store_url="https://test-store.com",
            consumer_key="ck_test",
            consumer_secret="cs_test",
        )

    # ========================================
    # US-012: eFact Invalid Response Tests
    # ========================================

    def test_efact_html_response_raises_efact_error(self, efact_client):
        """Test: HTML response instead of JSON raises EFactError (not JSONDecodeError)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError(
            "Expecting value",
            "<html><body>Error 500</body></html>",
            0,
        )
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            # Should be EFactError, not raw JSONDecodeError
            assert "Unexpected error" in str(exc_info.value)

    def test_efact_empty_response_handled(self, efact_client):
        """Test: Empty JSON response is handled."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}  # Empty response
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            # Should not crash, even with empty response
            result = efact_client.send_document({"Invoice": [{}]})
            assert result == {}

    # ========================================
    # US-012: Shopify Invalid Response Tests
    # ========================================

    @pytest.mark.asyncio
    async def test_shopify_missing_data_field_raises_value_error(self, shopify_client):
        """Test: Shopify response without 'data' field raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            # Missing 'data' field - malformed response
            "extensions": {"cost": {"requestedQueryCost": 1}}
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(ValueError) as exc_info:
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )

            # Should fail gracefully when trying to access result
            error_msg = str(exc_info.value).lower()
            assert "order" in error_msg or "created" in error_msg

    @pytest.mark.asyncio
    async def test_shopify_null_draft_order_in_response(self, shopify_client):
        """Test: Shopify response with null draftOrder raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderComplete": {
                    "draftOrder": None,  # Null draft order
                    "userErrors": [],
                }
            }
        }
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(ValueError) as exc_info:
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )

            assert "no draft order data returned" in str(exc_info.value).lower()

    # ========================================
    # US-012: WooCommerce Invalid Response Tests
    # ========================================

    @pytest.mark.asyncio
    async def test_woocommerce_empty_json_handled_gracefully(self, woocommerce_client):
        """Test: WooCommerce empty JSON response is handled."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}  # Empty response

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            # Should not crash with empty response
            result = await woocommerce_client.get_order(123)
            assert result == {}

    @pytest.mark.asyncio
    async def test_woocommerce_malformed_json_raises_error(self, woocommerce_client):
        """Test: WooCommerce malformed JSON raises appropriate error."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError(
            "Expecting value",
            "not valid json",
            0,
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(json.JSONDecodeError):
                await woocommerce_client.get_order(123)

    # ========================================
    # US-012: Unexpected Content-Type Tests
    # ========================================

    def test_efact_unexpected_content_type_handled(self, efact_client):
        """Test: Unexpected content type is handled gracefully."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/plain"}
        mock_response.json.side_effect = json.JSONDecodeError(
            "Expecting value",
            "Plain text response",
            0,
        )
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError):
                efact_client.send_document({"Invoice": [{}]})


class TestErrorMessageQuality:
    """Tests to ensure error messages are descriptive and useful."""

    @pytest.fixture(autouse=True)
    def reset_token_cache(self):
        """Reset token cache."""
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None
        yield
        _token_cache["access_token"] = None
        _token_cache["expires_at"] = None

    @pytest.fixture
    def efact_client(self) -> EFactClient:
        """Create EFactClient instance with mocked settings."""
        with patch("app.integrations.efact_client.settings") as mock_settings:
            mock_settings.EFACT_BASE_URL = "https://api.efact.pe"
            mock_settings.EFACT_RUC_VENTIA = "20123456789"
            mock_settings.EFACT_PASSWORD_REST = "test_password"
            mock_settings.EFACT_TOKEN_CACHE_HOURS = 11
            return EFactClient()

    def test_efact_auth_error_includes_status_code(self, efact_client):
        """Test: EFactAuthError includes HTTP status code in message."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        http_error = httpx.HTTPStatusError(
            message="401 Unauthorized",
            request=MagicMock(),
            response=mock_response,
        )
        mock_response.raise_for_status.side_effect = http_error

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactAuthError) as exc_info:
                efact_client._get_token()

            assert "401" in str(exc_info.value)

    def test_efact_error_includes_context(self, efact_client):
        """Test: EFactError includes useful context."""
        _token_cache["access_token"] = "valid_token"
        _token_cache["expires_at"] = datetime.utcnow() + timedelta(hours=1)

        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        http_error = httpx.HTTPStatusError(
            message="500 Server Error",
            request=MagicMock(),
            response=mock_response,
        )
        mock_response.raise_for_status.side_effect = http_error

        with patch("httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(EFactError) as exc_info:
                efact_client.send_document({"Invoice": [{}]})

            error_msg = str(exc_info.value)
            assert "500" in error_msg
            assert "Document submission failed" in error_msg
