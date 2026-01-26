"""
US-007: Tests de Cliente Shopify con Mocks

Tests for ShopifyClient GraphQL API integration with mocked HTTP responses.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

import httpx

from app.integrations.shopify_client import ShopifyClient


class TestShopifyClientCompleteDraftOrder:
    """Tests for complete_draft_order method in ShopifyClient."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance with test credentials."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_complete_draft_order_success_returns_order_info(
        self, shopify_client
    ):
        """Test: Successful complete_draft_order returns order info dict."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderComplete": {
                    "draftOrder": {
                        "id": "gid://shopify/DraftOrder/123",
                        "order": {
                            "id": "gid://shopify/Order/456",
                            "name": "#1001",
                            "createdAt": "2024-01-15T10:00:00Z",
                            "displayFulfillmentStatus": "UNFULFILLED",
                            "displayFinancialStatus": "PAID",
                        },
                    },
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

            result = await shopify_client.complete_draft_order(
                "gid://shopify/DraftOrder/123"
            )

            assert result["order_id"] == "gid://shopify/Order/456"
            assert result["order_name"] == "#1001"
            assert result["draft_order_id"] == "gid://shopify/DraftOrder/123"
            assert result["financial_status"] == "PAID"

    @pytest.mark.asyncio
    async def test_user_errors_in_response_raises_value_error(self, shopify_client):
        """Test: userErrors in response raises ValueError with details."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderComplete": {
                    "draftOrder": None,
                    "userErrors": [
                        {
                            "field": ["id"],
                            "message": "Draft order not found or already completed",
                        }
                    ],
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
                    "gid://shopify/DraftOrder/999"
                )

            error_msg = str(exc_info.value)
            assert "user errors" in error_msg.lower()
            assert "Draft order not found" in error_msg

    @pytest.mark.asyncio
    async def test_graphql_errors_in_response_raises_value_error(self, shopify_client):
        """Test: GraphQL errors in response raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "errors": [
                {
                    "message": "Field 'draftOrderComplete' doesn't exist on type 'Mutation'",
                    "locations": [{"line": 2, "column": 3}],
                }
            ]
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

            error_msg = str(exc_info.value)
            assert "GraphQL errors" in error_msg

    @pytest.mark.asyncio
    async def test_draft_order_not_found_raises_value_error(self, shopify_client):
        """Test: Draft order completed but no order created raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderComplete": {
                    "draftOrder": {
                        "id": "gid://shopify/DraftOrder/123",
                        "order": None,  # No order was created
                    },
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

            assert "no order was created" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_timeout_raises_http_error(self, shopify_client):
        """Test: Timeout of 30s raises HTTPError."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.side_effect = httpx.TimeoutException(
                "Request timed out after 30 seconds",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.TimeoutException):
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )

    @pytest.mark.asyncio
    async def test_headers_include_shopify_access_token(self, shopify_client):
        """Test: Request headers include X-Shopify-Access-Token."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderComplete": {
                    "draftOrder": {
                        "id": "gid://shopify/DraftOrder/123",
                        "order": {
                            "id": "gid://shopify/Order/456",
                            "name": "#1001",
                            "createdAt": "2024-01-15T10:00:00Z",
                            "displayFulfillmentStatus": "UNFULFILLED",
                            "displayFinancialStatus": "PAID",
                        },
                    },
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

            await shopify_client.complete_draft_order("gid://shopify/DraftOrder/123")

            # Verify the post call was made with correct headers
            call_kwargs = mock_client.post.call_args
            headers = call_kwargs.kwargs.get("headers", call_kwargs[1].get("headers"))

            assert "X-Shopify-Access-Token" in headers
            assert headers["X-Shopify-Access-Token"] == "shpat_test_token_123"

    @pytest.mark.asyncio
    async def test_http_error_is_propagated(self, shopify_client):
        """Test: HTTP errors are propagated correctly."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        http_error = httpx.HTTPStatusError(
            message="401 Unauthorized",
            request=MagicMock(),
            response=mock_response,
        )
        mock_response.raise_for_status.side_effect = http_error

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.HTTPStatusError):
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )


class TestShopifyClientGetDraftOrder:
    """Tests for get_draft_order method in ShopifyClient."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance with test credentials."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_get_draft_order_success_returns_details(self, shopify_client):
        """Test: Successful get_draft_order returns draft order details."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrder": {
                    "id": "gid://shopify/DraftOrder/123",
                    "name": "#D1001",
                    "email": "customer@example.com",
                    "totalPrice": "118.00",
                    "currencyCode": "PEN",
                    "lineItems": {
                        "edges": [
                            {
                                "node": {
                                    "id": "gid://shopify/DraftOrderLineItem/1",
                                    "title": "Test Product",
                                    "quantity": 2,
                                    "originalUnitPrice": "50.00",
                                }
                            }
                        ]
                    },
                    "createdAt": "2024-01-15T10:00:00Z",
                    "updatedAt": "2024-01-15T10:30:00Z",
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

            result = await shopify_client.get_draft_order(
                "gid://shopify/DraftOrder/123"
            )

            assert result["id"] == "gid://shopify/DraftOrder/123"
            assert result["name"] == "#D1001"
            assert result["email"] == "customer@example.com"
            assert result["totalPrice"] == "118.00"

    @pytest.mark.asyncio
    async def test_get_draft_order_not_found_raises_value_error(self, shopify_client):
        """Test: Draft order not found raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrder": None  # Not found
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
                await shopify_client.get_draft_order("gid://shopify/DraftOrder/999")

            assert "not found" in str(exc_info.value).lower()


class TestShopifyClientConfiguration:
    """Tests for ShopifyClient configuration and initialization."""

    def test_graphql_url_is_built_correctly(self):
        """Test: GraphQL URL is built correctly from store URL and API version."""
        client = ShopifyClient(
            store_url="https://my-store.myshopify.com/",
            access_token="shpat_token",
            api_version="2024-01",
        )

        # URL should not have trailing slash and should include API version
        assert (
            client.graphql_url
            == "https://my-store.myshopify.com/admin/api/2024-01/graphql.json"
        )

    def test_headers_are_configured_correctly(self):
        """Test: Headers include Content-Type and Access Token."""
        client = ShopifyClient(
            store_url="https://my-store.myshopify.com",
            access_token="shpat_my_secret_token",
            api_version="2024-01",
        )

        assert client.headers["Content-Type"] == "application/json"
        assert client.headers["X-Shopify-Access-Token"] == "shpat_my_secret_token"

    def test_store_url_trailing_slash_is_removed(self):
        """Test: Trailing slash is removed from store URL."""
        client = ShopifyClient(
            store_url="https://my-store.myshopify.com/",
            access_token="shpat_token",
        )

        assert client.store_url == "https://my-store.myshopify.com"

    def test_default_api_version(self):
        """Test: Default API version is 2024-01."""
        client = ShopifyClient(
            store_url="https://my-store.myshopify.com",
            access_token="shpat_token",
        )

        assert client.api_version == "2024-01"


class TestShopifyClientNetworkErrors:
    """Tests for network error handling in ShopifyClient."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance with test credentials."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
        )

    @pytest.mark.asyncio
    async def test_connection_error_is_propagated(self, shopify_client):
        """Test: Connection errors are propagated."""
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
    async def test_request_error_is_propagated(self, shopify_client):
        """Test: Generic request errors are propagated."""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.side_effect = httpx.RequestError(
                "Network error",
                request=MagicMock(),
            )
            mock_client_class.return_value = mock_client

            with pytest.raises(httpx.RequestError):
                await shopify_client.complete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )
