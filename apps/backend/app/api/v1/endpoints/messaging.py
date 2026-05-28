"""
Messaging API endpoints - proxy to the standalone Rails messaging service.
"""


from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_permission_dual
from app.core.permissions import Role
from app.models.user import User
from app.schemas.messaging import (
    AccountResponse,
    AssignConversationRequest,
    CannedResponsesListResponse,
    ContactsListResponse,
    ConversationCountsResponse,
    ConversationDetailResponse,
    ConversationLabelsListResponse,
    ConversationListResponse,
    InboxListResponse,
    InboxTemplatesResponse,
    InstagramAuthorizeResponse,
    InstagramStatusResponse,
    ManualWhatsAppRequest,
    MessageListResponse,
    MessagingError,
    NotificationSettingsPayload,
    NotificationSettingsResponse,
    NotificationsResponse,
    PushTokenRequest,
    SendMessageRequest,
    SendMessageResponse,
    SendTemplateMessageRequest,
    SingleLabelResponse,
    SuccessMessageResponse,
    TemperatureConfigResponse,
    TeamsListResponse,
    UserSyncResponse,
    WebSocketTokenResponse,
    WhatsAppConnectRequest,
    WhatsAppHealthResponse,
    WhatsAppStatusResponse,
    LabelsListResponse,
)
from app.services.messaging_service import messaging_service

router = APIRouter()


def _resolve_tenant_id(current_user: User, tenant_id_override: int | None = None) -> int:
    """Resolve tenant_id: SUPERADMIN can override to view other tenants."""
    if tenant_id_override and current_user.role == Role.SUPERADMIN:
        return tenant_id_override
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant assigned")
    return current_user.tenant_id


def _map_ventia_role_to_messaging(role: Role) -> str:
    """Map Ventia role to messaging AccountUser role."""
    if role == Role.SUPERADMIN:
        return "superadmin"
    if role == Role.ADMIN:
        return "administrator"
    return "agent"


# --- Account provisioning ---

@router.post(
    "/accounts/provision",
    response_model=AccountResponse,
    summary="Provision messaging account for current tenant",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def provision_account(
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
    db: Session = Depends(get_db),
):
    """
    Creates a new messaging Account linked to the current user's tenant in the messaging service.

    This endpoint initializes the messaging infrastructure for a tenant and must be called before
    any messaging operations. The operation is idempotent—calling it multiple times with the
    same tenant will not create duplicates.

    """
    from app.models.tenant import Tenant

    tenant_id = _resolve_tenant_id(current_user)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    account_data = {
        "name": tenant.name,
        "ventia_tenant_id": str(tenant.id),
    }

    result = await messaging_service.create_account(tenant_id, account_data)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Temperature config ---

@router.get(
    "/temperature-config",
    response_model=TemperatureConfigResponse,
    summary="Get temperature configuration for the tenant",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_temperature_config(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves the current conversation temperature configuration for the tenant.

    Temperature settings categorize conversations into cold (low priority), warm (medium),
    or hot (high priority) based on business logic and SLA rules. These settings help
    prioritize incoming conversations.

    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await messaging_service.get_temperature_config(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result


@router.put(
    "/temperature-config",
    response_model=TemperatureConfigResponse,
    summary="Update temperature configuration for the tenant",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def update_temperature_config(
    payload: dict,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("PUT", "/messaging/*")),
):
    """
    Updates the conversation temperature configuration rules for the tenant.

    Allows customizing how conversations are categorized by temperature to match business
    priorities. Changes apply immediately to all new conversation categorizations.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "key": "cold",
          "name": "Cold",
          "color": "#1f93ff",
          "icon": "snowflake",
          "position": 1,
          "updated_at": "2026-04-28T14:30:00Z"
        },
        {
          "key": "warm",
          "name": "Warm",
          "color": "#ffa500",
          "icon": "flame",
          "position": 2,
          "updated_at": "2026-04-28T14:30:00Z"
        },
        {
          "key": "hot",
          "name": "Hot",
          "color": "#ff1744",
          "icon": "fire",
          "position": 3,
          "updated_at": "2026-04-28T14:30:00Z"
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    config = payload.get("temperature_config", [])
    result = await messaging_service.update_temperature_config(tenant_id, config)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result


# --- User sync ---

@router.post(
    "/users/sync",
    response_model=UserSyncResponse,
    summary="Sync current user to messaging service",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def sync_user(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Creates or updates the current authenticated user in the messaging service.

    This endpoint synchronizes Ventia user data (name, email, role) with the messaging platform,
    ensuring the user can send messages and participate in conversations. The mapping of
    Ventia roles to messaging roles is: SUPERADMIN → 'superadmin', ADMIN → 'administrator',
    others → 'agent'.

    **Example response:**
    ```json
    {
      "user": {
        "id": 3,
        "name": "Juan Pérez",
        "email": "juan.perez@empresa.com",
        "avatar_url": null,
        "ventia_user_id": 789,
        "pubsub_token": "-Pslg2tHwkH8PhD63mz9rQ",
        "type": "user"
      },
      "account_user": {
        "id": 19,
        "role": "administrator",
        "availability": "online",
        "user_id": 3,
        "user": {
          "id": 3,
          "name": "Juan Pérez",
          "email": "juan.perez@empresa.com",
          "avatar_url": null,
          "ventia_user_id": 789,
          "pubsub_token": "-Pslg2tHwkH8PhD63mz9rQ",
          "type": "user"
        }
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    role = _map_ventia_role_to_messaging(current_user.role)

    user_data = {
        "ventia_user_id": current_user.id,
        "name": current_user.name or current_user.email,
        "email": current_user.email,
        "role": role,
    }

    result = await messaging_service.sync_user(tenant_id, user_data)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/ws-token",
    response_model=WebSocketTokenResponse,
    summary="Get WebSocket token for real-time messaging",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_ws_token(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
    db: Session = Depends(get_db),
):
    """
    Returns the pubsub_token required to establish a WebSocket connection to the messaging service.

    The token is user-specific and tenant-scoped, and is needed to connect to ActionCable WebSocket
    for real-time conversation updates. If the user doesn't exist yet, this endpoint automatically
    provisions the account and syncs the user. The flow is: (1) try to get token, (2) if failed
    sync user, (3) if still failed provision account, (4) sync user again, (5) final attempt.

    **Example response:**
    ```json
    {
      "pubsub_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "account_id": "1",
      "user_id": "456"
    }
    ```
    """
    from app.models.tenant import Tenant

    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    # 1. Try to get token directly (happy path)
    result = await messaging_service.get_user_token(tenant_id, current_user.id)
    if result:
        return result

    # 2. Token failed → sync user (creates User + AccountUser if missing)
    role = _map_ventia_role_to_messaging(current_user.role)
    user_data = {
        "ventia_user_id": current_user.id,
        "name": current_user.name or current_user.email,
        "email": current_user.email,
        "role": role,
    }
    sync_result = await messaging_service.sync_user(tenant_id, user_data)
    if sync_result:
        result = await messaging_service.get_user_token(tenant_id, current_user.id)
        if result:
            return result

    # 3. Sync failed → account probably missing → provision it
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    await messaging_service.create_account(tenant_id, {
        "name": tenant.name,
        "ventia_tenant_id": tenant.id,
    })

    # 4. Account created → sync user again
    await messaging_service.sync_user(tenant_id, user_data)

    # 5. Final attempt
    result = await messaging_service.get_user_token(tenant_id, current_user.id)
    if result:
        return result

    raise HTTPException(
        status_code=503,
        detail="Messaging service unavailable",
    )


# --- Conversations ---

@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List conversations",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_conversations(
    status: str | None = Query(None, description="Filter by status: open, resolved, pending"),
    stage: str | None = Query(None, description="Filter by stage: pre_sale, sale"),
    conversation_type: str | None = Query(None, description="Filter by type: unattended"),
    page: int | None = Query(None, description="Page number"),
    label: str | None = Query(None, description="Filter by label title"),
    temperature: str | None = Query(None, description="Filter by temperature: cold, warm, hot"),
    created_after: str | None = Query(None, description="Filter by date (ISO) from"),
    created_before: str | None = Query(None, description="Filter by date (ISO) to"),
    unread: str | None = Query(None, description="Filter unread only: true"),
    ai_agent_enabled: bool | None = Query(None, description="Filter by AI agent status: true/false"),
    search: str | None = Query(None, description="Search by contact name, phone or email"),
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves a paginated list of conversations for the current tenant.

    Supports filtering by status, stage, type, labels, temperature, creation date range, and search terms.
    Results are paginated and include metadata about total count and pages.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 6047,
          "uuid": "36139cfa-21e4-44e4-bfc9-fdb0cbc972a7",
          "status": "open",
          "stage": "pre_sale",
          "priority": "low",
          "last_activity_at": "2026-04-28T21:27:56.783Z",
          "created_at": "2026-04-28T21:22:57.668Z",
          "messages_count": 15,
          "unread_count": 5,
          "contact": {
            "name": "Juan Pérez",
            "phone_number": "+51956384035"
          },
          "inbox": {
            "name": "Main Inbox",
            "channel_type": "Whatsapp"
          },
          "last_message": {
            "content": "Thank you for your order...",
            "message_type": "outgoing",
            "created_at": "2026-04-28T21:27:56.783Z"
          }
        }
      ],
      "meta": {
        "current_page": 1,
        "total_pages": 5,
        "total_count": 87
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    params = {}
    if status:
        params["status"] = status
    if stage:
        params["stage"] = stage
    if conversation_type:
        params["conversation_type"] = conversation_type
    if page:
        params["page"] = page
    if label:
        params["label"] = label
    if temperature:
        params["temperature"] = temperature
    if created_after:
        params["created_after"] = created_after
    if created_before:
        params["created_before"] = created_before
    if unread:
        params["unread"] = unread
    if ai_agent_enabled is not None:
        params["ai_agent_enabled"] = str(ai_agent_enabled).lower()
    if search:
        params["search"] = search

    result = await messaging_service.get_conversations(tenant_id, params or None)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/conversations/counts",
    response_model=ConversationCountsResponse,
    summary="Get conversation counts by section",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_conversation_counts(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Returns a summary of conversation counts organized by different sections.

    Useful for displaying dashboard metrics like total conversations, sale stage conversations,
    and unattended conversations.

    **Example response:**
    ```json
    {
      "success": true,
      "data": {
        "all": 87,
        "sale": 12,
        "unattended": 3
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_conversation_counts(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/conversations/export",
    summary="Export conversations as JSON for CSV download",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def export_conversations(
    status: str | None = Query(None),
    stage: str | None = Query(None),
    conversation_type: str | None = Query(None),
    label: str | None = Query(None),
    temperature: str | None = Query(None),
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
    unread: str | None = Query(None),
    ai_agent_enabled: bool | None = Query(None),
    search: str | None = Query(None),
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/export")),
):
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    params = {}
    if status:
        params["status"] = status
    if stage:
        params["stage"] = stage
    if conversation_type:
        params["conversation_type"] = conversation_type
    if label:
        params["label"] = label
    if temperature:
        params["temperature"] = temperature
    if created_after:
        params["created_after"] = created_after
    if created_before:
        params["created_before"] = created_before
    if unread:
        params["unread"] = unread
    if ai_agent_enabled is not None:
        params["ai_agent_enabled"] = str(ai_agent_enabled).lower()
    if search:
        params["search"] = search

    result = await messaging_service.export_conversations(tenant_id, params or None)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Get conversation details",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_conversation(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves the full details of a specific conversation.

    Includes contact information, assignee, team, message count, labels, AI agent status,
    and all metadata about a single conversation.

    **Example response:**
    ```json
    {
      "success": true,
      "data": {
        "id": 6003,
        "uuid": "9d6f6864-ccd5-4716-aac4-ef5934a43d9b",
        "status": "open",
        "stage": "pre_sale",
        "priority": "low",
        "temperature": null,
        "can_reply": false,
        "last_activity_at": "2026-04-23T04:05:12.618Z",
        "agent_last_seen_at": "2026-04-28T20:20:41.884Z",
        "created_at": "2026-04-19T22:20:53.151Z",
        "contact": {
          "id": 5549,
          "name": "Maria González",
          "phone_number": "+51940793543",
          "email": null
        },
        "assignee": null,
        "team": null,
        "inbox_id": 52,
        "labels": [],
        "ai_agent_enabled": true,
        "messages_count": 3,
        "unread_count": 0,
        "last_message": {
          "content": "Hello, I have a question...",
          "message_type": "incoming",
          "status": "sent",
          "created_at": "2026-04-19T22:20:53.159Z"
        }
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Update a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def update_conversation(
    conversation_id: str,
    payload: dict,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("PATCH", "/messaging/*")),
):
    """
    Updates various properties of a conversation.

    Allows bulk updates of conversation fields such as status, priority, and AI agent enabled flag.
    Returns the updated conversation with all changes applied.

    **Example request:**
    ```json
    {
      "status": "resolved",
      "priority": "high",
      "ai_agent_enabled": false
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.update_conversation(
        tenant_id, conversation_id, payload
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/update_last_seen",
    response_model=ConversationDetailResponse,
    summary="Mark conversation as read",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def update_last_seen(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Updates the agent_last_seen_at timestamp for the current user on a conversation.

    Effectively marks the conversation as read, removing it from the user's unread list.
    Returns the updated conversation with the new agent_last_seen_at timestamp.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.update_last_seen(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.delete(
    "/conversations/{conversation_id}",
    response_model=SuccessMessageResponse,
    summary="Delete a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def delete_conversation(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("DELETE", "/messaging/*")),
):
    """
    Permanently removes a conversation from the system.

    This is a destructive operation and cannot be undone. The conversation and all its
    associated messages are deleted from the database.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.delete_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/update_stage",
    response_model=ConversationDetailResponse,
    summary="Update conversation business stage",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def update_conversation_stage(
    conversation_id: str,
    payload: dict,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Updates the business stage of a conversation.

    Categorizes conversations into pre-sale (before purchase) or sale (post-purchase) stages
    to track the customer lifecycle.

    **Example request:**
    ```json
    {
      "stage": "sale"
    }
    ```
    Valid stages: `pre_sale`, `sale`
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    stage = payload.get("stage")
    if stage not in ("pre_sale", "sale"):
        raise HTTPException(status_code=400, detail="stage must be 'pre_sale' or 'sale'")

    result = await messaging_service.update_conversation_stage(
        tenant_id, conversation_id, stage
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/escalate",
    response_model=ConversationDetailResponse,
    summary="Escalate conversation to human support",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def escalate_conversation(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Escalates a conversation to human support.

    Disables the AI agent and adds a human support label. Use this when the AI agent
    cannot handle a conversation and manual intervention is needed.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.escalate_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/resolve_escalation",
    response_model=ConversationDetailResponse,
    summary="Resolve escalation: remove human support label and re-enable AI agent",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def resolve_escalation(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Resolves an escalation by removing the human support label and re-enabling the AI agent.

    Use this when the human support intervention is complete and the AI agent can resume
    handling the conversation.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.resolve_escalation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/mark-payment-review",
    response_model=ConversationDetailResponse,
    summary="Mark conversation for payment review",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def mark_payment_review(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Marks a conversation for payment review by adding the 'en-revisión' label.

    This flags a conversation as requiring payment-related follow-up or verification.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.mark_payment_review(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Messages ---

@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="List messages in a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_messages(
    conversation_id: str,
    page: int | None = Query(None, description="Page number"),
    before: int | None = Query(None, description="Load messages with id < this value (scroll up)"),
    after: int | None = Query(None, description="Load messages with id > this value (catch up)"),
    around: int | None = Query(None, description="Load messages centered around this message id"),
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves a paginated list of messages for a specific conversation. Supports cursor-based
    pagination with before/after parameters for efficient scrolling through conversation history.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1001,
          "content": "Message content from agent",
          "message_type": "outgoing",
          "status": "read",
          "created_at": "2026-04-29T10:30:00.000Z"
        },
        {
          "id": 1002,
          "content": "Message content from contact",
          "message_type": "incoming",
          "content_type": "text",
          "content_attributes": {},
          "status": "sent",
          "created_at": "2026-04-29T10:31:00.000Z",
          "sender": {
            "type": "contact",
            "name": "Contact Name"
          },
          "attachments": []
        }
      ],
      "meta": {
        "has_more": true
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    params = {}
    if page:
        params["page"] = page
    if around:
        params["around"] = around
    elif before:
        params["before"] = before
    elif after:
        params["after"] = after

    result = await messaging_service.get_messages(tenant_id, conversation_id, params or None)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/conversations/{conversation_id}/messages/search",
    summary="Search messages by content in a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def search_messages(
    conversation_id: str,
    q: str = Query(..., min_length=2, description="Search query term"),
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Searches message content within a specific conversation using full-text search.
    Returns matching messages with highlighted snippets (HTML with <mark> tags).
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.search_messages(tenant_id, conversation_id, q)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendMessageResponse,
    summary="Send a message",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Sends a text message or message with content attributes in a conversation. The message
    is delivered to the contact and stored in the messaging system. Tracks the sender user ID
    for audit purposes.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Message sent",
      "data": {
        "id": 1003,
        "content": "Message content",
        "message_type": "outgoing",
        "content_type": "text",
        "content_attributes": {},
        "status": "sent",
        "created_at": "2026-04-29T10:32:00.000Z",
        "sender": null,
        "attachments": []
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.send_message(
        tenant_id,
        conversation_id,
        payload.model_dump(exclude_none=True),
        user_id=current_user.id,
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/messages/upload",
    response_model=SendMessageResponse,
    summary="Send a message with file attachment",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def send_message_with_attachment(
    conversation_id: str,
    content: str = Form(""),
    file: UploadFile = File(...),
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Sends a message with a file attachment via multipart/form-data. Supports various file
    types including images, documents, and other media. The file is uploaded and attached
    to the message in a single request.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Message sent",
      "data": {
        "id": 1004,
        "content": "Message with attachment",
        "message_type": "outgoing",
        "content_type": "text",
        "content_attributes": {},
        "status": "sent",
        "created_at": "2026-04-29T10:33:00.000Z",
        "sender": null,
        "attachments": [
          {
            "id": 2001,
            "file_type": "image",
            "filename": "document.jpg",
            "file_size": 102400,
            "extension": null,
            "meta": {},
            "data_url": "https://example.com/storage/blobs/file.jpg"
          }
        ]
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.send_message_with_file(
        tenant_id,
        conversation_id,
        content=content,
        file=file,
        user_id=current_user.id,
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Assignments ---

@router.post(
    "/conversations/{conversation_id}/assign",
    response_model=SuccessMessageResponse,
    summary="Assign conversation to agent or team",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def assign_conversation(
    conversation_id: str,
    payload: AssignConversationRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Assigns a conversation to a specific agent (user) or team. Only one agent or team can
    own a conversation at a time. Reassigning transfers ownership from the current assignee
    to the new one.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.assign_conversation(
        tenant_id, conversation_id, payload.model_dump(exclude_none=True)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/unassign",
    response_model=SuccessMessageResponse,
    summary="Remove assignment from conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def unassign_conversation(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Removes the current assignment from a conversation, leaving it unassigned. Useful for
    releasing a conversation back to the queue or when an agent becomes unavailable.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.unassign_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Inboxes ---

@router.get(
    "/inboxes",
    response_model=InboxListResponse,
    summary="List inboxes",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_inboxes(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all inboxes configured for the tenant. Inboxes represent different communication
    channels (WhatsApp, Email, etc.) through which conversations are received.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "name": "Inbox Name",
          "channel_type": "Channel::Whatsapp",
          "channel_id": 1,
          "account_id": 1,
          "greeting_enabled": false,
          "greeting_message": "",
          "enable_auto_assignment": true,
          "auto_assignment_config": {},
          "allow_messages_after_resolved": true,
          "lock_to_single_conversation": false,
          "working_hours_enabled": false,
          "out_of_office_message": null,
          "timezone": "UTC",
          "created_at": "2026-04-29T10:30:00.000Z",
          "updated_at": "2026-04-29T10:30:00.000Z"
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_inboxes(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/inboxes/{inbox_id}/templates",
    response_model=InboxTemplatesResponse,
    summary="Get WhatsApp templates for an inbox",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def get_inbox_templates(
    inbox_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all pre-approved WhatsApp message templates available for a specific inbox.
    These templates are managed by Meta and are required for sending template-based WhatsApp
    messages.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "1234567890",
          "name": "template_name",
          "status": "APPROVED",
          "category": "MARKETING",
          "language": "es_PE",
          "components": [
            {
              "text": "Template message body text",
              "type": "BODY"
            }
          ],
          "parameter_format": "POSITIONAL",
          "previous_category": "UTILITY",
          "is_primary_device_delivery_only": false
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_inbox_templates(tenant_id, inbox_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/inboxes/{inbox_id}/sync_templates",
    response_model=SuccessMessageResponse,
    summary="Sync WhatsApp templates from Meta for an inbox",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def sync_inbox_templates(
    inbox_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Synchronizes the latest WhatsApp message templates from Meta's platform to the local system.
    This should be called periodically to keep templates up-to-date or after approving new
    templates in Meta's dashboard.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Templates synced successfully"
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.sync_inbox_templates(tenant_id, inbox_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Template Messages ---

@router.post(
    "/conversations/{conversation_id}/messages/template",
    response_model=SendMessageResponse,
    summary="Send a template message",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def send_template_message(
    conversation_id: str,
    payload: SendTemplateMessageRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Sends a pre-defined template message with parameter substitution. Used primarily for
    WhatsApp template messages where Meta requires pre-approved templates. Supports parameter
    injection for dynamic content like names or order numbers.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Message sent",
      "data": {
        "id": 1005,
        "content": "Template message content",
        "message_type": "template",
        "content_type": "text",
        "content_attributes": {},
        "status": "sent",
        "created_at": "2026-04-29T10:34:00.000Z",
        "sender": null,
        "attachments": []
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    message_data = {
        "template_params": payload.template_params.model_dump(exclude_none=True),
    }

    result = await messaging_service.send_message(
        tenant_id,
        conversation_id,
        message_data,
        user_id=current_user.id,
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Contacts ---

@router.get(
    "/contacts",
    response_model=ContactsListResponse,
    summary="List contacts",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_contacts(
    search: str | None = Query(None, description="Search by name, email, or phone"),
    page: int | None = Query(None, description="Page number"),
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves a paginated list of contacts for the tenant. Supports searching by contact name,
    email, or phone number. Contacts are individuals who have participated in conversations.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "5549",
          "name": "Maria González",
          "phone_number": "+51940793543",
          "email": "maria@example.com"
        },
        {
          "id": "5314",
          "name": "Juan Pérez",
          "phone_number": "+51956384035",
          "email": null
        }
      ],
      "meta": {
        "current_page": 1,
        "total_pages": 3,
        "total_count": 45
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    if search:
        result = await messaging_service.search_contacts(tenant_id, search)
    else:
        params = {}
        if page:
            params["page"] = page
        result = await messaging_service.get_contacts(tenant_id, params or None)

    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Canned Responses ---

@router.get(
    "/canned-responses",
    response_model=CannedResponsesListResponse,
    summary="List canned responses",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_canned_responses(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all pre-configured canned responses available for the tenant. Canned responses
    are templated message snippets that agents can quickly insert into conversations to provide
    consistent, pre-approved answers to common questions.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "cr_101",
          "short_code": "thanks",
          "content": "Thank you for reaching out! We appreciate your interest."
        },
        {
          "id": "cr_102",
          "short_code": "help",
          "content": "How can we help you today? Please describe your inquiry in detail."
        },
        {
          "id": "cr_103",
          "short_code": "order_status",
          "content": "Your order is being processed. You'll receive a tracking number shortly."
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_canned_responses(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Labels ---


@router.get(
    "/labels",
    response_model=LabelsListResponse,
    summary="List labels",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_labels(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all system and custom labels configured for the tenant. Labels are used to
    categorize and organize conversations for better management and filtering.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "title": "Label Name",
          "color": "#9C27B0",
          "system": false
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_labels(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/labels",
    response_model=SingleLabelResponse,
    summary="Create a label",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def create_label(
    payload: dict,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Creates a new custom label for the tenant. Labels can be applied to conversations for
    organization, reporting, and filtering purposes.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Label created",
      "data": {
        "id": 1,
        "title": "New Label",
        "color": "#FF8000",
        "system": false
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.create_label(tenant_id, payload)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.delete(
    "/labels/{label_id}",
    response_model=SuccessMessageResponse,
    summary="Delete a label from the system",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def delete_label(
    label_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("DELETE", "/messaging/*")),
):
    """
    Permanently deletes a custom label from the system. The label is removed from all
    conversations that had it applied.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Label deleted"
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.delete_label(tenant_id, label_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/conversations/{conversation_id}/labels",
    response_model=ConversationLabelsListResponse,
    summary="List labels for a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_conversation_labels(
    conversation_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all labels currently applied to a specific conversation. Labels help
    categorize and organize conversations.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "title": "Label Name",
          "color": "#9C27B0"
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_conversation_labels(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/labels",
    response_model=SingleLabelResponse,
    summary="Add a label to a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def add_conversation_label(
    conversation_id: str,
    payload: dict,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Applies a label to a conversation. A conversation can have multiple labels applied
    simultaneously for flexible organization.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Label added",
      "data": {
        "id": 1,
        "title": "Label Name",
        "color": "#9C27B0"
      }
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    label_id = payload.get("label_id")
    if not label_id:
        raise HTTPException(status_code=400, detail="label_id is required")

    result = await messaging_service.add_conversation_label(
        tenant_id, conversation_id, label_id
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.delete(
    "/conversations/{conversation_id}/labels/{label_id}",
    response_model=SuccessMessageResponse,
    summary="Remove a label from a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def remove_conversation_label(
    conversation_id: str,
    label_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("DELETE", "/messaging/*")),
):
    """
    Removes a specific label from a conversation. The label remains in the system and can
    be applied to other conversations.

    **Example response:**
    ```json
    {
      "success": true,
      "message": "Label removed"
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.remove_conversation_label(
        tenant_id, conversation_id, label_id
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Teams ---

@router.get(
    "/teams",
    response_model=TeamsListResponse,
    summary="List teams",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_teams(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all teams configured for the tenant. Teams are groups of agents that can be
    assigned conversations collectively. Each team includes members and collaboration settings.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "team_123",
          "name": "Sales Team",
          "members_count": 5
        },
        {
          "id": "team_456",
          "name": "Support Team",
          "members_count": 8
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_teams(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Notifications ---

@router.get(
    "/notifications",
    response_model=NotificationsResponse,
    summary="List notifications",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_notifications(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves all notifications for the current user. Notifications include system events,
    message alerts, assignment updates, and other important platform events.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.get_notifications(
        tenant_id, current_user.id
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- WhatsApp ---


@router.post(
    "/whatsapp/embedded_signup",
    response_model=SuccessMessageResponse,
    summary="Connect WhatsApp via embedded signup",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def connect_whatsapp(
    payload: WhatsAppConnectRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Initiates WhatsApp connection using Meta's embedded signup flow. This is the preferred
    method for connecting WhatsApp Business Account (WABA) to the platform. Generates a unique
    signup URL that redirects to Meta's authorization interface.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.whatsapp_connect(
        tenant_id, payload.model_dump(exclude_none=True)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/whatsapp/status",
    response_model=WhatsAppStatusResponse,
    summary="List connected WhatsApp channels",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def whatsapp_status(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves the status and details of all WhatsApp channels (inboxes) currently connected
    for the tenant. Shows connection health, phone numbers, and operational status.

    **Example response:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 1,
          "phone_number": "+12345678900",
          "provider": "whatsapp_cloud",
          "inbox_id": 1,
          "inbox_name": "WhatsApp Channel",
          "templates_count": 5,
          "last_template_sync": "2026-04-29T10:30:00.000Z",
          "reauthorization_required": false
        }
      ]
    }
    ```
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.whatsapp_status(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/whatsapp/health/{inbox_id}",
    response_model=WhatsAppHealthResponse,
    summary="Get WhatsApp channel health status",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def whatsapp_health(
    inbox_id: str,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves detailed health status information for a specific WhatsApp channel. Includes
    connection state, message throughput, error rates, and other operational metrics.

    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.whatsapp_health(tenant_id, inbox_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/whatsapp/manual-connect",
    response_model=SuccessMessageResponse,
    summary="Connect WhatsApp with manual credentials",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def manual_connect_whatsapp(
    payload: ManualWhatsAppRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Establishes WhatsApp connection using manually provided credentials (API key, phone number ID,
    business account ID). Used as an alternative to embedded signup when direct credential entry
    is preferred.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    inbox_data = {
        "name": payload.name or f"{payload.phone_number} WhatsApp",
        "channel": {
            "type": "whatsapp",
            "phone_number": payload.phone_number,
            "provider": "whatsapp_cloud",
            "provider_config": {
                "api_key": payload.api_key,
                "phone_number_id": payload.phone_number_id,
                "business_account_id": payload.business_account_id,
            },
        },
    }

    result = await messaging_service.create_whatsapp_inbox(tenant_id, inbox_data)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Instagram ---


@router.get(
    "/instagram/authorize",
    response_model=InstagramAuthorizeResponse,
    summary="Get Instagram Login authorize URL",
    tags=["messaging", "instagram"],
    responses={503: {"model": MessagingError}},
)
async def instagram_authorize(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Returns the Instagram Login authorize URL (with a signed state tying the flow to the
    tenant). The frontend opens this URL in a new tab to start the OAuth consent flow.
    Channel creation happens server-side in the messaging service callback.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.instagram_authorize(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/instagram/status",
    response_model=InstagramStatusResponse,
    summary="List connected Instagram channels",
    tags=["messaging", "instagram"],
    responses={503: {"model": MessagingError}},
)
async def instagram_status(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves the status and details of all Instagram channels (inboxes) currently connected
    for the tenant.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)

    result = await messaging_service.instagram_status(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Push Subscription Tokens ---


@router.post(
    "/push-tokens",
    response_model=SuccessMessageResponse,
    summary="Register FCM push token",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def register_push_token(
    payload: PushTokenRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("POST", "/messaging/*")),
):
    """
    Registers a Firebase Cloud Messaging (FCM) token for the current user. Enables push
    notifications on mobile and web platforms. Each device generates a unique token.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await messaging_service.register_push_token(
        tenant_id, str(current_user.id), payload.model_dump(exclude_none=True)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result


@router.delete(
    "/push-tokens",
    response_model=SuccessMessageResponse,
    summary="Remove FCM push token",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def delete_push_token(
    payload: PushTokenRequest,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("DELETE", "/messaging/*")),
):
    """
    Unregisters a Firebase Cloud Messaging token, disabling push notifications for that device.
    Called when user logs out or uninstalls the app.
    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await messaging_service.delete_push_token(
        tenant_id, str(current_user.id), payload.token
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result


# --- Notification Settings ---


@router.get(
    "/notification-settings",
    response_model=NotificationSettingsResponse,
    summary="Get notification settings",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_notification_settings(
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("GET", "/messaging/*")),
):
    """
    Retrieves the current user's push notification preferences. Includes flags for different
    notification types (human support, payment review, AI messages, etc.).

    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await messaging_service.get_notification_settings(
        tenant_id, str(current_user.id)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result


@router.put(
    "/notification-settings",
    response_model=NotificationSettingsResponse,
    summary="Update notification settings",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def update_notification_settings(
    payload: NotificationSettingsPayload,
    tenant_id: int | None = Query(None, description="Tenant override (SUPERADMIN only)"),
    current_user: User = Depends(require_permission_dual("PATCH", "/messaging/*")),
):
    """
    Updates the current user's push notification preferences. Allows users to enable or
    disable specific types of notifications.

    """
    tenant_id = _resolve_tenant_id(current_user, tenant_id)
    result = await messaging_service.update_notification_settings(
        tenant_id, str(current_user.id), payload.model_dump(exclude_none=True)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")
    return result
