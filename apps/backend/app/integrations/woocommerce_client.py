"""
WooCommerce REST API client.

Provides HTTP client for WooCommerce REST API operations like
fetching orders and marking them as paid.
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class WooCommerceError(Exception):
    """Base exception for WooCommerce API errors."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class WooCommerceAuthError(WooCommerceError):
    """Raised when WooCommerce authentication fails (401)."""

    pass


class WooCommerceNotFoundError(WooCommerceError):
    """Raised when a resource is not found in WooCommerce (404)."""

    pass


class WooCommerceClient:
    """
    Client for WooCommerce REST API v3.

    Uses httpx for async HTTP requests to WooCommerce.
    Authenticates using HTTP Basic Auth with consumer key/secret.

    Attributes:
        store_url: WooCommerce store URL
        base_url: Full API base URL ({store_url}/wp-json/wc/v3)
        timeout: Request timeout in seconds (default: 30)
    """

    def __init__(
        self,
        store_url: str,
        consumer_key: str,
        consumer_secret: str,
        timeout: float = 30.0,
    ) -> None:
        """
        Initialize WooCommerce client with store credentials.

        Args:
            store_url: WooCommerce store URL (e.g., 'https://my-store.com')
            consumer_key: WooCommerce REST API consumer key (ck_xxx)
            consumer_secret: WooCommerce REST API consumer secret (cs_xxx)
            timeout: Request timeout in seconds (default: 30)
        """
        self.store_url = store_url.rstrip("/")
        self.base_url = f"{self.store_url}/wp-json/wc/v3"
        self.timeout = timeout

        # HTTP Basic Auth with consumer key and secret
        self._auth = httpx.BasicAuth(consumer_key, consumer_secret)

        # Default headers (User-Agent needed for some WordPress hosts)
        self._headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "VentIA/1.0 (WooCommerce API Client)",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Make an HTTP request to WooCommerce REST API.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (e.g., '/orders/123')
            data: Optional request body data

        Returns:
            dict: JSON response from WooCommerce

        Raises:
            WooCommerceAuthError: If authentication fails (401)
            WooCommerceNotFoundError: If resource not found (404)
            WooCommerceError: For other HTTP errors
            httpx.RequestError: For network/connection errors
        """
        url = f"{self.base_url}{endpoint}"

        async with httpx.AsyncClient(
            http2=False,
            timeout=self.timeout,
            verify=False,  # Many WordPress hosts have misconfigured SSL chains
        ) as client:
            try:
                response = await client.request(
                    method=method,
                    url=url,
                    auth=self._auth,
                    headers=self._headers,
                    json=data,
                    timeout=self.timeout,
                )

                # Handle specific HTTP errors
                if response.status_code == 401:
                    raise WooCommerceAuthError(
                        "Invalid WooCommerce credentials",
                        status_code=401,
                    )

                if response.status_code == 404:
                    raise WooCommerceNotFoundError(
                        f"Resource not found: {endpoint}",
                        status_code=404,
                    )

                # Raise for other HTTP errors
                response.raise_for_status()

                return response.json()

            except httpx.HTTPStatusError as e:
                logger.error(f"WooCommerce HTTP error: {e.response.status_code} - {e}")
                raise WooCommerceError(
                    f"HTTP error {e.response.status_code}: {e.response.text}",
                    status_code=e.response.status_code,
                ) from e

            except httpx.RequestError as e:
                logger.error(f"WooCommerce request error: {e}")
                raise

    async def get_order(self, order_id: int) -> dict[str, Any]:
        """
        Get order details from WooCommerce.

        Args:
            order_id: WooCommerce order ID

        Returns:
            dict: Order data including status, totals, line items, etc.

        Raises:
            WooCommerceNotFoundError: If order doesn't exist
            WooCommerceError: For other API errors
        """
        return await self._request("GET", f"/orders/{order_id}")

    async def mark_order_as_paid(self, order_id: int) -> dict[str, Any]:
        """
        Mark an order as paid in WooCommerce.

        Sets `set_paid: true` which updates the order with:
        - `date_paid`: Current timestamp
        - `status`: Changed to "processing"

        Args:
            order_id: WooCommerce order ID

        Returns:
            dict: Updated order data with date_paid and status="processing"

        Raises:
            WooCommerceNotFoundError: If order doesn't exist
            WooCommerceError: For other API errors
        """
        return await self._request(
            "PUT",
            f"/orders/{order_id}",
            data={"set_paid": True},
        )

    async def update_order_status(
        self,
        order_id: int,
        status: str,
    ) -> dict[str, Any]:
        """
        Update an order's status in WooCommerce.

        Valid statuses: pending, processing, on-hold, completed,
        cancelled, refunded, failed, trash

        Args:
            order_id: WooCommerce order ID
            status: New order status

        Returns:
            dict: Updated order data

        Raises:
            WooCommerceNotFoundError: If order doesn't exist
            WooCommerceError: For other API errors
        """
        return await self._request(
            "PUT",
            f"/orders/{order_id}",
            data={"status": status},
        )

    async def create_order(self, order_data: dict[str, Any]) -> dict[str, Any]:
        """
        Create a new order in WooCommerce.

        Args:
            order_data: Order data including line_items, billing, etc.

        Returns:
            dict: Created order data with ID

        Raises:
            WooCommerceError: For API errors
        """
        return await self._request("POST", "/orders", data=order_data)
