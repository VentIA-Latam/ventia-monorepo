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


class TestShopifyClientDeleteDraftOrder:
    """Tests for delete_draft_order method in ShopifyClient."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance with test credentials."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_delete_draft_order_success_returns_deleted_id(self, shopify_client):
        """Test: Successful deletion returns the deletedId."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderDelete": {
                    "deletedId": "gid://shopify/DraftOrder/123",
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

            result = await shopify_client.delete_draft_order(
                "gid://shopify/DraftOrder/123"
            )

            assert result == "gid://shopify/DraftOrder/123"

    @pytest.mark.asyncio
    async def test_delete_draft_order_user_errors_raises_value_error(
        self, shopify_client
    ):
        """Test: userErrors in response raises ValueError with details."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderDelete": {
                    "deletedId": None,
                    "userErrors": [
                        {
                            "field": ["id"],
                            "message": "Draft order not found",
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
                await shopify_client.delete_draft_order(
                    "gid://shopify/DraftOrder/999"
                )

            assert "user errors" in str(exc_info.value).lower()
            assert "Draft order not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_delete_draft_order_no_deleted_id_raises_value_error(
        self, shopify_client
    ):
        """Test: Missing deletedId in response raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "draftOrderDelete": {
                    "deletedId": None,
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
                await shopify_client.delete_draft_order(
                    "gid://shopify/DraftOrder/123"
                )

            assert "no deleted id" in str(exc_info.value).lower()


class TestShopifyClientCancelOrder:
    """Tests for cancel_order method in ShopifyClient."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        """Create ShopifyClient instance with test credentials."""
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_cancel_order_success_returns_order_data(self, shopify_client):
        """Test: Successful cancellation returns job with id and done status."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCancel": {
                    "job": {
                        "id": "gid://shopify/Job/123",
                        "done": True,
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

            result = await shopify_client.cancel_order(
                order_id="gid://shopify/Order/456",
                reason="CUSTOMER",
                restock=True,
                notify_customer=True,
                refund_method="original",
                staff_note="Cliente solicitó cancelación",
            )

            assert result["id"] == "gid://shopify/Job/123"
            assert result["done"] == True

    @pytest.mark.asyncio
    async def test_cancel_order_user_errors_raises_value_error(self, shopify_client):
        """Test: userErrors in response raises ValueError with details."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCancel": {
                    "job": None,
                    "userErrors": [
                        {
                            "field": ["id"],
                            "message": "Order is already cancelled",
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
                await shopify_client.cancel_order(
                    order_id="gid://shopify/Order/456",
                    reason="CUSTOMER",
                    restock=True,
                    notify_customer=True,
                    refund_method="original",
                    staff_note=None,
                )

            assert "user errors" in str(exc_info.value).lower()
            assert "already cancelled" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_cancel_order_no_order_in_response_raises_value_error(
        self, shopify_client
    ):
        """Test: Missing job in response raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCancel": {
                    "job": None,
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
                await shopify_client.cancel_order(
                    order_id="gid://shopify/Order/456",
                    reason="FRAUD",
                    restock=False,
                    notify_customer=False,
                    refund_method="original",
                    staff_note=None,
                )

            assert "no job data" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_cancel_order_refund_method_mapping(self, shopify_client):
        """Test: refund_method values map correctly to variables (refundMethod removed from mutation)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCancel": {
                    "job": {"id": "gid://shopify/Job/123", "done": True},
                    "userErrors": [],
                }
            }
        }
        mock_response.raise_for_status = MagicMock()

        # Note: refund_method is currently not implemented in the mutation
        # This test verifies the method accepts the parameter without errors
        for refund_method in ["original", "store_credit", "later"]:
            with patch("httpx.AsyncClient") as mock_client_class:
                mock_client = AsyncMock()
                mock_client.__aenter__.return_value = mock_client
                mock_client.__aexit__.return_value = None
                mock_client.post.return_value = mock_response
                mock_client_class.return_value = mock_client

                result = await shopify_client.cancel_order(
                    order_id="gid://shopify/Order/456",
                    reason="CUSTOMER",
                    restock=True,
                    notify_customer=True,
                    refund_method=refund_method,
                    staff_note=None,
                )

                # Verify the method completes without error
                assert result["id"] == "gid://shopify/Job/123"
                assert result["done"] == True

    @pytest.mark.asyncio
    async def test_cancel_order_staff_note_included_when_provided(
        self, shopify_client
    ):
        """Test: staffNote is included in variables when staff_note is provided."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCancel": {
                    "job": {"id": "gid://shopify/Job/123", "done": True},
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

            await shopify_client.cancel_order(
                order_id="gid://shopify/Order/456",
                reason="STAFF",
                restock=True,
                notify_customer=False,
                refund_method="original",
                staff_note="Nota interna del personal",
            )

            call_kwargs = mock_client.post.call_args
            payload = call_kwargs.kwargs.get("json", call_kwargs[1].get("json"))
            variables = payload["variables"]

            assert variables["staffNote"] == "Nota interna del personal"

    @pytest.mark.asyncio
    async def test_cancel_order_staff_note_omitted_when_none(self, shopify_client):
        """Test: staffNote is NOT in variables when staff_note is None."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCancel": {
                    "job": {"id": "gid://shopify/Job/123", "done": True},
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

            await shopify_client.cancel_order(
                order_id="gid://shopify/Order/456",
                reason="OTHER",
                restock=False,
                notify_customer=True,
                refund_method="original",
                staff_note=None,
            )

            call_kwargs = mock_client.post.call_args
            payload = call_kwargs.kwargs.get("json", call_kwargs[1].get("json"))
            variables = payload["variables"]

            assert "staffNote" not in variables


class TestShopifyClientCreatePaidOrderDelivery:
    """Tests for DELIVERY SKU separation into shippingLines."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_delivery_item_separated_to_shipping_lines(self, shopify_client):
        """Test that items with SKU=DELIVERY go to shippingLines, not lineItems."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCreate": {
                    "order": {
                        "id": "gid://shopify/Order/123",
                        "name": "#1001",
                        "createdAt": "2024-01-15T10:00:00Z",
                        "displayFinancialStatus": "PAID",
                        "displayFulfillmentStatus": "UNFULFILLED",
                    },
                    "userErrors": [],
                }
            }
        }
        mock_response.raise_for_status = MagicMock()

        line_items = [
            {"variantId": "gid://shopify/ProductVariant/1", "quantity": 1, "unitPrice": 49.0},
            {"sku": "DELIVERY", "product": "Envio a domicilio", "quantity": 1, "unitPrice": 13.0},
        ]

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            await shopify_client.create_paid_order(
                line_items=line_items,
                customer_email="test@example.com",
                currency="PEN",
            )

            call_kwargs = mock_client.post.call_args
            payload = call_kwargs.kwargs.get("json", call_kwargs[1].get("json"))
            order_input = payload["variables"]["order"]

            # DELIVERY should be in shippingLines, not lineItems
            assert len(order_input["lineItems"]) == 1
            assert "shippingLines" in order_input
            assert order_input["shippingLines"][0]["title"] == "Envio a domicilio"
            assert order_input["shippingLines"][0]["priceSet"]["shopMoney"]["amount"] == "13.0"

    @pytest.mark.asyncio
    async def test_only_delivery_items_raises_error(self, shopify_client):
        """Test that having only DELIVERY items raises ValueError."""
        line_items = [
            {"sku": "DELIVERY", "product": "Envio", "quantity": 1, "unitPrice": 10.0},
        ]

        with pytest.raises(ValueError, match="At least one non-delivery line item"):
            await shopify_client.create_paid_order(
                line_items=line_items,
                customer_email="test@example.com",
            )


class TestShopifyClientCreatePaidOrderShippingAddress:
    """Tests for shipping address formatting in create_paid_order."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_shipping_address_includes_customer_name(self, shopify_client):
        """Test that shipping address gets firstName/lastName from customer_name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCreate": {
                    "order": {
                        "id": "gid://shopify/Order/123",
                        "name": "#1001",
                        "createdAt": "2024-01-15T10:00:00Z",
                        "displayFinancialStatus": "PAID",
                        "displayFulfillmentStatus": "UNFULFILLED",
                    },
                    "userErrors": [],
                }
            }
        }
        mock_response.raise_for_status = MagicMock()

        line_items = [{"variantId": "gid://shopify/ProductVariant/1", "quantity": 1, "unitPrice": 49.0}]

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            await shopify_client.create_paid_order(
                line_items=line_items,
                customer_email="victor@example.com",
                customer_name="Victor Toro Alvarez",
                shipping_address={"address1": "Calle 123", "city": "Lima", "province": "LIM"},
            )

            call_kwargs = mock_client.post.call_args
            payload = call_kwargs.kwargs.get("json", call_kwargs[1].get("json"))
            addr = payload["variables"]["order"]["shippingAddress"]

            assert addr["firstName"] == "Victor"
            assert addr["lastName"] == "Toro Alvarez"
            assert addr["provinceCode"] == "LIM"

    @pytest.mark.asyncio
    async def test_shipping_address_without_name_gets_placeholder(self, shopify_client):
        """Test that shipping address gets lastName='.' when no customer_name."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "orderCreate": {
                    "order": {
                        "id": "gid://shopify/Order/123",
                        "name": "#1001",
                        "createdAt": "2024-01-15T10:00:00Z",
                        "displayFinancialStatus": "PAID",
                        "displayFulfillmentStatus": "UNFULFILLED",
                    },
                    "userErrors": [],
                }
            }
        }
        mock_response.raise_for_status = MagicMock()

        line_items = [{"variantId": "gid://shopify/ProductVariant/1", "quantity": 1, "unitPrice": 49.0}]

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            await shopify_client.create_paid_order(
                line_items=line_items,
                customer_email="test@example.com",
                shipping_address={"address1": "Calle 123"},
            )

            call_kwargs = mock_client.post.call_args
            payload = call_kwargs.kwargs.get("json", call_kwargs[1].get("json"))
            addr = payload["variables"]["order"]["shippingAddress"]

            assert addr["lastName"] == "."


class TestShopifyClientGetOrder:
    """Tests for get_order method."""

    @pytest.fixture
    def shopify_client(self) -> ShopifyClient:
        return ShopifyClient(
            store_url="https://test-store.myshopify.com",
            access_token="shpat_test_token_123",
            api_version="2024-01",
        )

    @pytest.mark.asyncio
    async def test_get_order_success(self, shopify_client):
        """Test successful order retrieval."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "order": {
                    "id": "gid://shopify/Order/456",
                    "name": "#1001",
                    "email": "test@example.com",
                    "phone": "+51987654321",
                    "customer": {
                        "phone": "+51987654321",
                        "email": "test@example.com",
                        "firstName": "Victor",
                        "lastName": "Toro",
                    },
                    "createdAt": "2024-01-15T10:00:00Z",
                    "displayFinancialStatus": "PAID",
                    "displayFulfillmentStatus": "UNFULFILLED",
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

            result = await shopify_client.get_order("gid://shopify/Order/456")

            assert result["id"] == "gid://shopify/Order/456"
            assert result["name"] == "#1001"
            assert result["customer"]["firstName"] == "Victor"

    @pytest.mark.asyncio
    async def test_get_order_not_found_raises_error(self, shopify_client):
        """Test that missing order raises ValueError."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"order": None}}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client.post.return_value = mock_response
            mock_client_class.return_value = mock_client

            with pytest.raises(ValueError, match="not found"):
                await shopify_client.get_order("gid://shopify/Order/999")
