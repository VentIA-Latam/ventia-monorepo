"""
Messaging service - HTTP client for the standalone Rails messaging module.
"""

import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MessagingService:
    """Service for communicating with the standalone messaging module."""

    def __init__(self):
        self.base_url = settings.MESSAGING_SERVICE_URL.rstrip("/")
        self.api_key = settings.MESSAGING_SERVICE_API_KEY

    def _headers(self, tenant_id: int, user_id: Optional[str] = None) -> dict:
        """Build request headers with tenant and optional user context."""
        headers = {
            "X-Tenant-Id": str(tenant_id),
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        if user_id:
            headers["X-User-Id"] = str(user_id)
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        tenant_id: int,
        user_id: Optional[str] = None,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> Optional[dict]:
        """Make an HTTP request to the messaging service."""
        url = f"{self.base_url}{path}"
        headers = self._headers(tenant_id, user_id)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    params=params,
                    json=json_data,
                )

                if response.status_code in (200, 201):
                    return response.json()
                elif response.status_code == 204:
                    return {"success": True}
                else:
                    logger.error(
                        f"Messaging API error: {method} {path} -> {response.status_code} - {response.text[:500]}"
                    )
                    return None

        except httpx.RequestError as e:
            logger.error(f"Messaging service request failed: {method} {path} -> {e}")
            return None

    # --- Account provisioning ---

    async def create_account(self, tenant_id: int, account_data: dict) -> Optional[dict]:
        """Create a messaging account for a Ventia tenant."""
        return await self._request(
            "POST", "/api/v1/accounts", tenant_id,
            json_data={"account": account_data}
        )

    # --- User management ---

    async def sync_user(self, tenant_id: int, user_data: dict) -> Optional[dict]:
        """Create or update a user in the messaging service."""
        return await self._request(
            "POST", "/api/v1/users", tenant_id, json_data={"user": user_data}
        )

    async def get_user_token(
        self, tenant_id: int, ventia_user_id: str
    ) -> Optional[dict]:
        """Get a user's pubsub_token for WebSocket authentication."""
        result = await self._request(
            "GET", "/api/v1/users", tenant_id, params={"ventia_user_id": ventia_user_id}
        )
        if not result:
            return None

        # Rails returns {success: true, data: [...]} format
        users = result.get("data", result)
        if isinstance(users, list) and len(users) > 0:
            user = users[0]
            pubsub_token = user.get("pubsub_token")
            if pubsub_token:
                return {
                    "pubsub_token": pubsub_token,
                    "account_id": str(user.get("account_id", tenant_id)),
                    "user_id": str(user.get("id")),
                }
        return None

    # --- Conversations ---

    async def get_conversations(
        self, tenant_id: int, params: Optional[dict] = None
    ) -> Optional[dict]:
        """List conversations for an account."""
        return await self._request("GET", "/api/v1/conversations", tenant_id, params=params)

    async def get_conversation(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Get a single conversation."""
        return await self._request(
            "GET", f"/api/v1/conversations/{conversation_id}", tenant_id
        )

    # --- Messages ---

    async def get_messages(
        self, tenant_id: int, conversation_id: str, params: Optional[dict] = None
    ) -> Optional[dict]:
        """List messages for a conversation."""
        return await self._request(
            "GET",
            f"/api/v1/conversations/{conversation_id}/messages",
            tenant_id,
            params=params,
        )

    async def send_message(
        self, tenant_id: int, conversation_id: str, payload: dict, user_id: Optional[str] = None
    ) -> Optional[dict]:
        """Send a message in a conversation."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/messages",
            tenant_id,
            user_id=user_id,
            json_data=payload,
        )

    # --- Assignments ---

    async def assign_conversation(
        self, tenant_id: int, conversation_id: str, payload: dict
    ) -> Optional[dict]:
        """Assign a conversation to an agent or team."""
        return await self._request(
            "PATCH",
            f"/api/v1/conversations/{conversation_id}/assign",
            tenant_id,
            json_data=payload,
        )

    async def unassign_conversation(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Remove assignment from a conversation."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/unassign",
            tenant_id,
        )

    # --- Inboxes ---

    async def get_inboxes(self, tenant_id: int) -> Optional[dict]:
        """List all inboxes for an account."""
        return await self._request("GET", "/api/v1/inboxes", tenant_id)

    # --- Contacts ---

    async def get_contacts(
        self, tenant_id: int, params: Optional[dict] = None
    ) -> Optional[dict]:
        """List contacts for an account."""
        return await self._request("GET", "/api/v1/contacts", tenant_id, params=params)

    async def search_contacts(
        self, tenant_id: int, query: str
    ) -> Optional[dict]:
        """Search contacts by name, email, or phone."""
        return await self._request(
            "POST", "/api/v1/contacts/search", tenant_id, json_data={"query": query}
        )

    # --- Canned Responses ---

    async def get_canned_responses(self, tenant_id: int) -> Optional[dict]:
        """List canned responses for an account."""
        return await self._request("GET", "/api/v1/canned_responses", tenant_id)

    # --- Teams ---

    async def get_teams(self, tenant_id: int) -> Optional[dict]:
        """List teams for an account."""
        return await self._request("GET", "/api/v1/teams", tenant_id)

    # --- Notifications ---

    async def get_notifications(
        self, tenant_id: int, user_id: str
    ) -> Optional[dict]:
        """List notifications for a user."""
        return await self._request(
            "GET", "/api/v1/notifications", tenant_id, user_id=user_id
        )

    # --- WhatsApp ---

    async def whatsapp_connect(
        self, tenant_id: int, payload: dict
    ) -> Optional[dict]:
        """Connect a WhatsApp number via embedded signup."""
        return await self._request(
            "POST", "/api/v1/whatsapp/embedded_signup", tenant_id, json_data=payload
        )

    async def whatsapp_status(self, tenant_id: int) -> Optional[dict]:
        """Get status of connected WhatsApp channels."""
        return await self._request(
            "GET", "/api/v1/whatsapp/embedded_signup/status", tenant_id
        )

    async def whatsapp_health(
        self, tenant_id: int, inbox_id: str
    ) -> Optional[dict]:
        """Get health status of a WhatsApp channel."""
        return await self._request(
            "GET", f"/api/v1/whatsapp/health/{inbox_id}", tenant_id
        )

    async def create_whatsapp_inbox(
        self, tenant_id: int, payload: dict
    ) -> Optional[dict]:
        """Create a WhatsApp inbox with manual credentials."""
        return await self._request(
            "POST", "/api/v1/inboxes", tenant_id, json_data=payload
        )


# Global service instance
messaging_service = MessagingService()
