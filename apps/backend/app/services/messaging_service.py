"""
Messaging service - HTTP client for the standalone Rails messaging module.
"""

import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MessagingClientError(Exception):
    """Raised when the messaging service returns a 4xx response with usable detail.

    A global FastAPI exception handler converts this into an HTTP response with the
    original status code so the operator sees the real error (e.g. template not found)
    instead of a generic 503.
    """

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"{status_code}: {detail}")


class MessagingService:
    """Service for communicating with the standalone messaging module."""

    def __init__(self):
        self.base_url = settings.MESSAGING_SERVICE_URL.rstrip("/")
        self.api_key = settings.MESSAGING_SERVICE_API_KEY

    def _headers(self, tenant_id: int, user_id: Optional[str] = None) -> dict:
        """Build request headers with tenant and optional user context."""
        from app.api.deps import current_user_id_var

        headers = {
            "X-Tenant-Id": str(tenant_id),
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        resolved_user_id = user_id or current_user_id_var.get()
        if resolved_user_id:
            headers["X-User-Id"] = str(resolved_user_id)
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
                if response.status_code == 204:
                    return {"success": True}

                # 4xx: Rails rejected the request with a usable reason. Propagate so the
                # operator sees the real error instead of a generic 503.
                if 400 <= response.status_code < 500:
                    detail = self._extract_error_detail(response)
                    logger.warning(
                        f"Messaging API client error: {method} {path} -> {response.status_code} - {detail}"
                    )
                    raise MessagingClientError(response.status_code, detail)

                # 5xx: service-level failure. Keep "service unavailable" semantics.
                logger.error(
                    f"Messaging API server error: {method} {path} -> {response.status_code} - {response.text[:500]}"
                )
                return None

        except httpx.RequestError as e:
            logger.error(f"Messaging service request failed: {method} {path} -> {e}")
            return None

    @staticmethod
    def _extract_error_detail(response: httpx.Response) -> str:
        """Best-effort extraction of a user-facing error message from a 4xx response."""
        try:
            body = response.json()
        except Exception:
            return (response.text or response.reason_phrase)[:500]

        if isinstance(body, dict):
            # Rails messaging response shape (base_controller.rb:48 render_error)
            if body.get("error"):
                return str(body["error"])
            # FastAPI/Pydantic style
            if body.get("detail"):
                return str(body["detail"])
            if body.get("message"):
                return str(body["message"])

        return (response.text or response.reason_phrase)[:500]

    async def _request_with_status(
        self,
        method: str,
        path: str,
        tenant_id: int,
        user_id: Optional[str] = None,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
        timeout: float = 10.0,
    ) -> tuple[Optional[dict], int]:
        """Like _request() but returns (response_data, status_code). status_code=0 on network error."""
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

                if response.status_code == 204:
                    return {"success": True}, 204

                try:
                    return response.json(), response.status_code
                except Exception:
                    return None, response.status_code

        except httpx.RequestError as e:
            logger.error(f"Messaging service request failed: {method} {path} -> {e}")
            return None, 0

    # --- Account provisioning ---

    async def create_account(self, tenant_id: int, account_data: dict) -> Optional[dict]:
        """Create a messaging account for a Ventia tenant."""
        return await self._request(
            "POST", "/api/v1/accounts", tenant_id,
            json_data={"account": account_data}
        )

    # --- Temperature config ---

    async def get_temperature_config(self, tenant_id: int) -> Optional[dict]:
        """Get temperature configuration for an account."""
        return await self._request("GET", "/api/v1/accounts/temperature_config", tenant_id)

    async def update_temperature_config(self, tenant_id: int, config: list) -> Optional[dict]:
        """Update temperature configuration for an account."""
        return await self._request(
            "PUT", "/api/v1/accounts/temperature_config", tenant_id,
            json_data={"temperature_config": config}
        )

    # --- User management ---

    async def sync_user(self, tenant_id: int, user_data: dict) -> Optional[dict]:
        """Create or update a user in the messaging service."""
        data = {**user_data}
        role = data.pop("role", None)
        payload: dict = {"user": data}
        if role:
            payload["role"] = role
        return await self._request(
            "POST", "/api/v1/users", tenant_id, json_data=payload
        )

    async def get_user_token(
        self, tenant_id: int, ventia_user_id: int
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

    async def export_conversations(
        self, tenant_id: int, params: Optional[dict] = None
    ) -> Optional[dict]:
        """Export conversations filtered by active filters (no pagination)."""
        return await self._request(
            "GET", "/api/v1/conversations/export", tenant_id, params=params,
            timeout=30.0,
        )

    async def get_conversations_count_by_period(
        self,
        tenant_id: int,
        start_date: str,
        end_date: str,
        user_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Get total conversations count for a tenant in a date range.

        Calls the Rails analytics endpoint that filters by `created_at`. The
        result is the denominator for the conversion rate metric (US-CONV-004).

        Args:
            tenant_id: Tenant id propagated to messaging via X-Tenant-Id.
            start_date: ISO 8601 timestamp (UTC recommended).
            end_date: ISO 8601 timestamp (UTC recommended).
            user_id: Optional Ventia user id, propagated as X-User-Id.

        Returns:
            On success: dict shaped `{"success": True, "data": {"total": int,
                "period": {"start_date": str, "end_date": str}}}`.
            On HTTP / network failure: None (logged in `_request`).
            Note: callers should treat any payload without `data.total` as a
            failure (e.g. unexpected Rails 200 with `success=False`).
        """
        return await self._request(
            "GET",
            "/api/v1/analytics/conversations_count",
            tenant_id,
            user_id=user_id,
            params={"start_date": start_date, "end_date": end_date},
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

    async def resolve_escalation(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Resolve escalation: remove human support label and re-enable AI agent."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/resolve_escalation",
            tenant_id,
        )

    async def mark_payment_review(
        self, tenant_id: int, conversation_id: str
    ) -> Optional[dict]:
        """Mark conversation for payment review (add en-revisión label)."""
        return await self._request(
            "POST",
            f"/api/v1/conversations/{conversation_id}/mark_payment_review",
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

    async def search_messages(
        self, tenant_id: int, conversation_id: str, query: str
    ) -> Optional[dict]:
        """Search messages by content using full-text search."""
        return await self._request(
            "GET",
            f"/api/v1/conversations/{conversation_id}/messages/search",
            tenant_id,
            params={"q": query},
            timeout=15.0,
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

    async def send_by_phone(
        self, tenant_id: int, payload: dict, user_id: Optional[str] = None
    ) -> Optional[dict]:
        """Send a WhatsApp template to a phone number.

        Creates contact/conversation if needed; reuses open conversation otherwise.
        Payload goes flat (phone, inbox_id, template_params, contact_name) — NOT wrapped
        in {"message": ...} because the Rails endpoint receives flat params.
        """
        return await self._request(
            "POST",
            "/api/v1/messages/send_by_phone",
            tenant_id,
            user_id=user_id,
            json_data=payload,
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

    async def find_contact_by_phone(
        self, tenant_id: int, phone: str
    ) -> Optional[dict]:
        """Find a contact by exact phone_number match and return its latest conversation.

        Used by webhook auto-linking (try_link_conversation) to associate Shopify/WooCommerce
        orders with their messaging conversation. The Rails endpoint returns the most recent
        conversation per contact, which is the one we link to the order.

        Args:
            tenant_id: Tenant id propagated to messaging via X-Tenant-Id.
            phone: Phone in E.164 format (e.g. "+51999888777").

        Returns:
            On success: dict shaped `{"success": True, "data": {"contact_id": int,
            "phone_number": str, "name": str, "conversation": {"id": int, "created_at": str} | None}}`.
            Returns None on transport/HTTP error.
        """
        return await self._request(
            "GET",
            "/api/v1/contacts/find_by_phone",
            tenant_id,
            params={"phone": phone},
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

    # --- Instagram ---

    async def instagram_authorize(self, tenant_id: int) -> Optional[dict]:
        """Get the Instagram Login authorize URL (with signed state) for the tenant."""
        return await self._request(
            "GET", "/api/v1/instagram/authorize", tenant_id
        )

    async def instagram_status(self, tenant_id: int) -> Optional[dict]:
        """Get status of connected Instagram channels."""
        return await self._request(
            "GET", "/api/v1/instagram/status", tenant_id
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

    # --- Push Subscription Tokens ---

    async def register_push_token(
        self, tenant_id: int, user_id: str, payload: dict
    ) -> Optional[dict]:
        """Register an FCM push subscription token."""
        return await self._request(
            "POST", "/api/v1/push_subscription_tokens", tenant_id,
            user_id=user_id,
            json_data={"push_subscription_token": payload},
        )

    async def delete_push_token(
        self, tenant_id: int, user_id: str, token: str
    ) -> Optional[dict]:
        """Remove an FCM push subscription token."""
        return await self._request(
            "DELETE", "/api/v1/push_subscription_tokens", tenant_id,
            user_id=user_id,
            json_data={"token": token},
        )

    # --- Notification Settings ---

    async def get_notification_settings(
        self, tenant_id: int, user_id: str
    ) -> Optional[dict]:
        """Get notification settings for the current user."""
        return await self._request(
            "GET", "/api/v1/notification_settings", tenant_id, user_id=user_id,
        )

    async def update_notification_settings(
        self, tenant_id: int, user_id: str, payload: dict
    ) -> Optional[dict]:
        """Update notification settings for the current user."""
        return await self._request(
            "PUT", "/api/v1/notification_settings", tenant_id,
            user_id=user_id,
            json_data={"notification_settings": payload},
        )

    # --- No purchase reason ---

    async def get_no_purchase_reasons(
        self,
        tenant_id: int,
        start_date: str,
        end_date: str,
    ) -> tuple[Optional[dict], int]:
        return await self._request_with_status(
            "GET",
            "/api/v1/analytics/no_purchase_reasons",
            tenant_id,
            params={"start_date": start_date, "end_date": end_date},
            timeout=15.0,
        )

    async def set_no_purchase_reason(
        self,
        tenant_id: int,
        conversation_id: int,
        reason: str,
    ) -> tuple[Optional[dict], int]:
        return await self._request_with_status(
            "POST",
            f"/api/v1/conversations/{conversation_id}/no_purchase_reason",
            tenant_id,
            json_data={"reason": reason},
            timeout=15.0,
        )

    # --- Ads summary ---

    async def get_ads_summary(
        self,
        tenant_id: int,
        start_date: str,
        end_date: str,
        converted_conversation_ids: list[int],
    ) -> tuple[Optional[dict], int]:
        """Aggregate conversations by Meta ad in a period.

        Sends the list of converted conversation_ids so Rails can compute
        started and converted counts per ad in a single SQL pass.
        """
        return await self._request_with_status(
            "POST",
            "/api/v1/analytics/ads_summary",
            tenant_id,
            json_data={
                "start_date": start_date,
                "end_date": end_date,
                "converted_conversation_ids": converted_conversation_ids,
            },
            timeout=15.0,
        )

    # --- Activity by hour (heatmap) ---

    async def get_activity_by_hour(
        self,
        tenant_id: int,
        start_date: str,
        end_date: str,
        timezone: str = "America/Lima",
        cross_tenant: bool = False,
    ) -> tuple[Optional[dict], int]:
        params: dict = {
            "start_date": start_date,
            "end_date": end_date,
            "timezone": timezone,
        }
        if cross_tenant:
            params["cross_tenant"] = "true"
        return await self._request_with_status(
            "GET",
            "/api/v1/analytics/activity_by_hour",
            tenant_id,
            params=params,
            timeout=15.0,
        )

    async def get_conversation_distribution(
        self,
        tenant_id: int,
        start_date: str,
        end_date: str,
        cross_tenant: bool = False,
    ) -> tuple[Optional[dict], int]:
        params: dict = {"start_date": start_date, "end_date": end_date}
        if cross_tenant:
            params["cross_tenant"] = "true"
        return await self._request_with_status(
            "GET",
            "/api/v1/analytics/conversation_distribution",
            tenant_id,
            params=params,
            timeout=15.0,
        )

    async def get_chats_started(
        self,
        tenant_id: int,
        start_date: str,
        end_date: str,
        timezone: str = "America/Lima",
        inbox_id: Optional[int] = None,
        cross_tenant: bool = False,
    ) -> tuple[Optional[dict], int]:
        params: dict = {
            "start_date": start_date,
            "end_date": end_date,
            "timezone": timezone,
        }
        if inbox_id is not None:
            params["inbox_id"] = str(inbox_id)
        if cross_tenant:
            params["cross_tenant"] = "true"
        return await self._request_with_status(
            "GET",
            "/api/v1/analytics/chats_started",
            tenant_id,
            params=params,
            timeout=15.0,
        )


# Global service instance
messaging_service = MessagingService()
