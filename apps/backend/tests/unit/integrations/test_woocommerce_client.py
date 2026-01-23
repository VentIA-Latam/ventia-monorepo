"""
US-008: Tests de Cliente WooCommerce con Mocks

Tests for WooCommerceClient REST API integration with mocked HTTP responses.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

import httpx

from app.integrations.woocommerce_client import (
    WooCommerceClient,
    WooCommerceError,
    WooCommerceAuthError,
    WooCommerceNotFoundError,
)


class TestWooCommerceClientMarkOrderAsPaid:
    """Tests for mark_order_as_paid method in WooCommerceClient."""

    @pytest.fixture
    def woocommerce_client(self) -> WooCommerceClient:
        """Create WooCommerceClient instance with test credentials."""
        return WooCommerceClient(
            store_url="https://test-store.com",
            consumer_key="ck_test_key_123",
            consumer_secret="cs_test_secret_456",
        )

    @pytest.mark.asyncio
    async def test_mark_order_as_paid_success_returns_processing_status(
        self, woocommerce_client
    ):
        """Test: Successful mark_order_as_paid returns order with status='processing'."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": 123,
            "status": "processing",
            "date_paid": "2024-01-15T10:30:00",
            "total": "118.00",
            "currency": "PEN",
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = await woocommerce_client.mark_order_as_paid(123)

            assert result["id"] == 123
            assert result["status"] == "processing"
            assert result["date_paid"] is not None

            # Verify request was made with correct data
            call_kwargs = mock_client.request.call_args
            assert call_kwargs.kwargs["json"] == {"set_paid": True}

    @pytest.mark.asyncio
    async def test_http_401_raises_woocommerce_auth_error(self, woocommerce_client):
        """Test: HTTP 401 response raises WooCommerceAuthError."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Invalid consumer key"

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(WooCommerceAuthError) as exc_info:
                await woocommerce_client.mark_order_as_paid(123)

            assert exc_info.value.status_code == 401
            assert "Invalid" in str(exc_info.value) or "credentials" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_http_404_raises_woocommerce_not_found_error(
        self, woocommerce_client
    ):
        """Test: HTTP 404 response raises WooCommerceNotFoundError."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Order not found"

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(WooCommerceNotFoundError) as exc_info:
                await woocommerce_client.mark_order_as_paid(999)

            assert exc_info.value.status_code == 404
            assert "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_http_500_raises_woocommerce_error(self, woocommerce_client):
        """Test: HTTP 500 response raises WooCommerceError."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="500 Server Error",
            request=MagicMock(),
            response=mock_response,
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(WooCommerceError) as exc_info:
                await woocommerce_client.mark_order_as_paid(123)

            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_http_429_rate_limit_raises_woocommerce_error_with_status(
        self, woocommerce_client
    ):
        """Test: HTTP 429 rate limit response raises WooCommerceError with status_code."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.text = "Rate limit exceeded"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="429 Too Many Requests",
            request=MagicMock(),
            response=mock_response,
        )

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(WooCommerceError) as exc_info:
                await woocommerce_client.mark_order_as_paid(123)

            assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_timeout_raises_request_error(self, woocommerce_client):
        """Test: Timeout raises RequestError."""
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


class TestWooCommerceClientGetOrder:
    """Tests for get_order method in WooCommerceClient."""

    @pytest.fixture
    def woocommerce_client(self) -> WooCommerceClient:
        """Create WooCommerceClient instance with test credentials."""
        return WooCommerceClient(
            store_url="https://test-store.com",
            consumer_key="ck_test_key_123",
            consumer_secret="cs_test_secret_456",
        )

    @pytest.mark.asyncio
    async def test_get_order_success_returns_order_details(self, woocommerce_client):
        """Test: Successful get_order returns order details."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": 123,
            "status": "pending",
            "total": "118.00",
            "currency": "PEN",
            "billing": {
                "first_name": "Juan",
                "last_name": "Perez",
                "email": "juan@example.com",
            },
            "line_items": [
                {
                    "id": 1,
                    "name": "Test Product",
                    "quantity": 2,
                    "total": "100.00",
                }
            ],
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = await woocommerce_client.get_order(123)

            assert result["id"] == 123
            assert result["status"] == "pending"
            assert result["total"] == "118.00"
            assert result["billing"]["email"] == "juan@example.com"

    @pytest.mark.asyncio
    async def test_get_order_not_found_raises_error(self, woocommerce_client):
        """Test: Order not found raises WooCommerceNotFoundError."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Order not found"

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(WooCommerceNotFoundError):
                await woocommerce_client.get_order(999)


class TestWooCommerceClientUpdateOrderStatus:
    """Tests for update_order_status method in WooCommerceClient."""

    @pytest.fixture
    def woocommerce_client(self) -> WooCommerceClient:
        """Create WooCommerceClient instance with test credentials."""
        return WooCommerceClient(
            store_url="https://test-store.com",
            consumer_key="ck_test_key_123",
            consumer_secret="cs_test_secret_456",
        )

    @pytest.mark.asyncio
    async def test_update_order_status_success(self, woocommerce_client):
        """Test: Successful order status update returns updated order."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": 123,
            "status": "completed",
            "total": "118.00",
        }

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.return_value = mock_response
            mock_client_class.return_value = mock_client

            result = await woocommerce_client.update_order_status(123, "completed")

            assert result["status"] == "completed"

            # Verify request was made with correct data
            call_kwargs = mock_client.request.call_args
            assert call_kwargs.kwargs["json"] == {"status": "completed"}


class TestWooCommerceClientConfiguration:
    """Tests for WooCommerceClient configuration and initialization."""

    def test_base_url_is_built_correctly(self):
        """Test: Base URL is built correctly from store URL."""
        client = WooCommerceClient(
            store_url="https://my-store.com/",
            consumer_key="ck_key",
            consumer_secret="cs_secret",
        )

        # URL should not have trailing slash and should include API path
        assert client.base_url == "https://my-store.com/wp-json/wc/v3"

    def test_store_url_trailing_slash_is_removed(self):
        """Test: Trailing slash is removed from store URL."""
        client = WooCommerceClient(
            store_url="https://my-store.com/",
            consumer_key="ck_key",
            consumer_secret="cs_secret",
        )

        assert client.store_url == "https://my-store.com"

    def test_default_timeout_is_30_seconds(self):
        """Test: Default timeout is 30 seconds."""
        client = WooCommerceClient(
            store_url="https://my-store.com",
            consumer_key="ck_key",
            consumer_secret="cs_secret",
        )

        assert client.timeout == 30.0

    def test_custom_timeout_can_be_set(self):
        """Test: Custom timeout can be configured."""
        client = WooCommerceClient(
            store_url="https://my-store.com",
            consumer_key="ck_key",
            consumer_secret="cs_secret",
            timeout=60.0,
        )

        assert client.timeout == 60.0


class TestWooCommerceClientNetworkErrors:
    """Tests for network error handling in WooCommerceClient."""

    @pytest.fixture
    def woocommerce_client(self) -> WooCommerceClient:
        """Create WooCommerceClient instance with test credentials."""
        return WooCommerceClient(
            store_url="https://test-store.com",
            consumer_key="ck_test_key_123",
            consumer_secret="cs_test_secret_456",
        )

    @pytest.mark.asyncio
    async def test_connection_error_is_propagated(self, woocommerce_client):
        """Test: Connection errors are propagated."""
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

    @pytest.mark.asyncio
    async def test_request_error_is_propagated(self, woocommerce_client):
        """Test: Generic request errors are propagated."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.request.side_effect = httpx.RequestError(
                "Network error",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.RequestError):
                await woocommerce_client.mark_order_as_paid(123)


class TestWooCommerceExceptions:
    """Tests for WooCommerce custom exceptions."""

    def test_woocommerce_error_has_status_code(self):
        """Test: WooCommerceError includes status_code."""
        error = WooCommerceError("Test error", status_code=500)

        assert error.status_code == 500
        assert error.message == "Test error"
        assert "Test error" in str(error)

    def test_woocommerce_auth_error_inherits_from_base(self):
        """Test: WooCommerceAuthError inherits from WooCommerceError."""
        error = WooCommerceAuthError("Auth failed", status_code=401)

        assert isinstance(error, WooCommerceError)
        assert error.status_code == 401

    def test_woocommerce_not_found_error_inherits_from_base(self):
        """Test: WooCommerceNotFoundError inherits from WooCommerceError."""
        error = WooCommerceNotFoundError("Not found", status_code=404)

        assert isinstance(error, WooCommerceError)
        assert error.status_code == 404

    def test_woocommerce_error_without_status_code(self):
        """Test: WooCommerceError can be created without status_code."""
        error = WooCommerceError("Network error")

        assert error.status_code is None
        assert error.message == "Network error"
