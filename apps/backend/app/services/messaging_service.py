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
        timeout: float = 10.0,
    ) -> Optional[dict]:
        """Make an HTTP request to the messaging service."""
        url = f"{self.base_url}{path}"
        headers = self._headers(tenant_id, user_id)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
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

    async def update_conversation(
        self, tenant_id: int, conversation_id: str, payload: dict
    ) -> Optional[dict]:
        """Update a conversation (status, priority, ai_agent_enabled, etc.)."""
        return await self._request(
            "PATCH",
            f"/api/v1/conversations/{conversation_id}",
            tenant_id,
            json_data={"conversation": payload},
        )

    async def update_last_seen(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Mark conversation as read (update agent_last_seen_at)."""
        return await self._request(
            "POST", f"/api/v1/conversations/{conversation_id}/update_last_seen", tenant_id
        )

    async def delete_conversation(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Delete a conversation."""
        return await self._request(
            "DELETE", f"/api/v1/conversations/{conversation_id}", tenant_id
        )

    async def get_conversation_counts(
        self, tenant_id: int, params: Optional[dict] = None
    ) -> Optional[dict]:
        """Get conversation counts by section (all, sale, unattended)."""
        return await self._request(
            "GET", "/api/v1/conversations/counts", tenant_id, params=params
        )

    async def update_conversation_stage(
        self, tenant_id: int, conversation_id: str, stage: str
    ) -> Optional[dict]:
        """Update the business stage of a conversation (pre_sale/sale)."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/update_stage",
            tenant_id,
            json_data={"stage": stage},
        )

    async def escalate_conversation(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Escalate conversation to human support (disable AI + add label)."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/escalate",
            tenant_id,
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
            json_data={"message": payload},
        )

    async def send_message_with_file(
        self,
        tenant_id: int,
        conversation_id: str,
        content: str,
        file: Any,
        user_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Send a message with a file attachment via multipart/form-data."""
        url = f"{self.base_url}/api/v1/conversations/{conversation_id}/messages"
        headers: dict[str, str] = {
            "X-Tenant-Id": str(tenant_id),
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        if user_id:
            headers["X-User-Id"] = str(user_id)

        try:
            file_content = await file.read()
            files = {
                "message[file]": (file.filename, file_content, file.content_type),
            }
            data = {
                "message[content]": content,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    headers=headers,
                    data=data,
                    files=files,
                )

                if response.status_code in (200, 201):
                    return response.json()
                else:
                    logger.error(
                        f"Messaging upload error: POST {url} -> {response.status_code} - {response.text[:500]}"
                    )
                    return None

        except httpx.RequestError as e:
            logger.error(f"Messaging upload request failed: {e}")
            return None

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

    async def get_inbox_templates(
        self, tenant_id: int, inbox_id: str
    ) -> Optional[dict]:
        """Get WhatsApp message templates for an inbox."""
        return await self._request(
            "GET", f"/api/v1/inboxes/{inbox_id}/templates", tenant_id
        )

    async def sync_inbox_templates(
        self, tenant_id: int, inbox_id: str
    ) -> Optional[dict]:
        """Trigger WhatsApp template sync for an inbox (Meta API can be slow with pagination)."""
        return await self._request(
            "POST", f"/api/v1/inboxes/{inbox_id}/sync_templates", tenant_id,
            timeout=30.0,
        )

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

    # --- Labels ---

    async def get_labels(self, tenant_id: int) -> Optional[dict]:
        """List all labels for an account."""
        return await self._request("GET", "/api/v1/labels", tenant_id)

    async def create_label(self, tenant_id: int, payload: dict) -> Optional[dict]:
        """Create a label."""
        return await self._request(
            "POST", "/api/v1/labels", tenant_id, json_data={"label": payload}
        )

    async def delete_label(self, tenant_id: int, label_id: str) -> Optional[dict]:
        """Delete a label from the system."""
        return await self._request(
            "DELETE", f"/api/v1/labels/{label_id}", tenant_id
        )

    async def get_conversation_labels(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """List labels for a conversation."""
        return await self._request(
            "GET", f"/api/v1/conversations/{conversation_id}/labels", tenant_id
        )

    async def add_conversation_label(
        self, tenant_id: int, conversation_id: str, label_id: str
    ) -> Optional[dict]:
        """Add a label to a conversation."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/labels",
            tenant_id,
            json_data={"label_id": label_id},
        )

    async def remove_conversation_label(
        self, tenant_id: int, conversation_id: str, label_id: str
    ) -> Optional[dict]:
        """Remove a label from a conversation."""
        return await self._request(
            "DELETE",
            f"/api/v1/conversations/{conversation_id}/labels/{label_id}",
            tenant_id,
        )

    # --- Webhooks ---

    async def get_webhooks(self, tenant_id: int) -> Optional[dict]:
        """List all webhooks for an account."""
        return await self._request("GET", "/api/v1/webhooks", tenant_id)

    async def create_webhook(
        self, tenant_id: int, payload: dict
    ) -> Optional[dict]:
        """Create a webhook for an account."""
        return await self._request(
            "POST", "/api/v1/webhooks", tenant_id,
            json_data={"webhook": payload},
        )

    async def update_webhook(
        self, tenant_id: int, webhook_id: str, payload: dict
    ) -> Optional[dict]:
        """Update a webhook."""
        return await self._request(
            "PATCH", f"/api/v1/webhooks/{webhook_id}", tenant_id,
            json_data={"webhook": payload},
        )

    async def delete_webhook(
        self, tenant_id: int, webhook_id: str
    ) -> Optional[dict]:
        """Delete a webhook."""
        return await self._request(
            "DELETE", f"/api/v1/webhooks/{webhook_id}", tenant_id,
        )


# Global service instance
messaging_service = MessagingService()
