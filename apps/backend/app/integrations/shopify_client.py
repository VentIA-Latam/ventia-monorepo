"""
Shopify GraphQL API client.
"""

import httpx
from typing import Any


class ShopifyClient:
    """
    Client for Shopify GraphQL Admin API.

    Uses httpx for async HTTP requests to Shopify.
    Credentials are tenant-specific (passed in constructor).
    """

    def __init__(
        self,
        store_url: str,
        access_token: str,
        api_version: str = "2024-01",
    ) -> None:
        """
        Initialize Shopify client with tenant credentials.

        Args:
            store_url: Shopify store URL (e.g., 'https://my-store.myshopify.com')
            access_token: Shopify Admin API access token
            api_version: Shopify API version (default: '2024-01')
        """
        self.store_url = store_url.rstrip("/")
        self.access_token = access_token
        self.api_version = api_version
        self.graphql_url = f"{self.store_url}/admin/api/{api_version}/graphql.json"

        # HTTP headers for Shopify API
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token,
        }

    async def _execute_query(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute a GraphQL query against Shopify API.

        Args:
            query: GraphQL query/mutation string
            variables: Optional variables for the query

        Returns:
            dict: Response data from Shopify

        Raises:
            httpx.HTTPError: If HTTP request fails
            ValueError: If Shopify returns errors in response
        """
        payload = {"query": query}
        if variables:
            payload["variables"] = variables

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.graphql_url,
                headers=self.headers,
                json=payload,
                timeout=30.0,
            )
            response.raise_for_status()

            data = response.json()

            # Check for GraphQL errors
            if "errors" in data:
                error_messages = [err.get("message", str(err)) for err in data["errors"]]
                raise ValueError(f"Shopify GraphQL errors: {'; '.join(error_messages)}")

            return data

    async def complete_draft_order(self, draft_order_id: str) -> dict[str, Any]:
        """
        Complete a draft order using Shopify GraphQL mutation.

        This converts a draft order into an official order.

        Args:
            draft_order_id: Draft order ID (e.g., 'gid://shopify/DraftOrder/123')

        Returns:
            dict: Result containing order info and invoice URL

        Example response:
            {
                "draftOrderComplete": {
                    "draftOrder": {
                        "id": "gid://shopify/DraftOrder/123",
                        "order": {
                            "id": "gid://shopify/Order/456",
                            "name": "#1001"
                        }
                    },
                    "userErrors": []
                }
            }

        Raises:
            ValueError: If mutation fails or returns user errors
        """
        mutation = """
        mutation draftOrderComplete($id: ID!) {
            draftOrderComplete(id: $id) {
                draftOrder {
                    id
                    order {
                        id
                        name
                        createdAt
                        displayFulfillmentStatus
                        displayFinancialStatus
                    }
                }
                userErrors {
                    field
                    message
                }
            }
        }
        """

        variables = {"id": draft_order_id}

        data = await self._execute_query(mutation, variables)

        # Extract result
        result = data.get("data", {}).get("draftOrderComplete", {})

        # Check for user errors
        user_errors = result.get("userErrors", [])
        if user_errors:
            error_messages = [
                f"{err.get('field', 'unknown')}: {err.get('message', 'unknown error')}"
                for err in user_errors
            ]
            raise ValueError(f"Shopify user errors: {'; '.join(error_messages)}")

        # Return completed draft order with order info
        draft_order = result.get("draftOrder", {})
        order = draft_order.get("order")

        if not order:
            raise ValueError("Draft order completed but no order was created")

        return {
            "draft_order_id": draft_order.get("id"),
            "order_id": order.get("id"),
            "order_name": order.get("name"),
            "created_at": order.get("createdAt"),
            "fulfillment_status": order.get("displayFulfillmentStatus"),
            "financial_status": order.get("displayFinancialStatus"),
        }

    async def get_draft_order(self, draft_order_id: str) -> dict[str, Any]:
        """
        Get draft order details using Shopify GraphQL query.

        Args:
            draft_order_id: Draft order ID

        Returns:
            dict: Draft order details

        Raises:
            ValueError: If query fails
        """
        query = """
        query getDraftOrder($id: ID!) {
            draftOrder(id: $id) {
                id
                name
                email
                totalPrice
                currencyCode
                lineItems(first: 50) {
                    edges {
                        node {
                            id
                            title
                            quantity
                            originalUnitPrice
                        }
                    }
                }
                createdAt
                updatedAt
            }
        }
        """

        variables = {"id": draft_order_id}

        data = await self._execute_query(query, variables)

        draft_order = data.get("data", {}).get("draftOrder")

        if not draft_order:
            raise ValueError(f"Draft order {draft_order_id} not found")

        return draft_order
