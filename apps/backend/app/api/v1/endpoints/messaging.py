"""
Messaging API endpoints - proxy to the standalone Rails messaging service.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.messaging import (
    AssignConversationRequest,
    ManualWhatsAppRequest,
    MessagingError,
    SendMessageRequest,
    UserSyncRequest,
    WebSocketTokenResponse,
    WhatsAppConnectRequest,
)
from app.services.messaging_service import messaging_service

router = APIRouter()


def _get_tenant_id(current_user: User) -> int:
    """Extract tenant_id from the authenticated user."""
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant assigned")
    return current_user.tenant_id


# --- Account provisioning ---

@router.post(
    "/accounts/provision",
    summary="Provision messaging account for current tenant",
    description="Creates a messaging Account linked to the current user's tenant. Idempotent.",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def provision_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.tenant import Tenant

    tenant_id = _get_tenant_id(current_user)
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


# --- User sync ---

@router.post(
    "/users/sync",
    summary="Sync current user to messaging service",
    description="Creates or updates the current user in the messaging service.",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def sync_user(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    user_data = {
        "ventia_user_id": current_user.auth0_user_id,
        "name": current_user.name or current_user.email,
        "email": current_user.email,
    }

    result = await messaging_service.sync_user(tenant_id, user_data)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/ws-token",
    response_model=WebSocketTokenResponse,
    summary="Get WebSocket token for real-time messaging",
    description="Returns the pubsub_token needed to connect to ActionCable WebSocket.",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_ws_token(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.get_user_token(tenant_id, current_user.auth0_user_id)
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Messaging service unavailable or user not synced",
        )

    return result


# --- Conversations ---

@router.get(
    "/conversations",
    summary="List conversations",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_conversations(
    status: Optional[str] = Query(None, description="Filter by status: open, resolved, pending"),
    page: Optional[int] = Query(None, description="Page number"),
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)
    params = {}
    if status:
        params["status"] = status
    if page:
        params["page"] = page

    result = await messaging_service.get_conversations(tenant_id, params or None)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/conversations/{conversation_id}",
    summary="Get conversation details",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.get_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.patch(
    "/conversations/{conversation_id}",
    summary="Update a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def update_conversation(
    conversation_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.update_conversation(
        tenant_id, conversation_id, payload
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.delete(
    "/conversations/{conversation_id}",
    summary="Delete a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.delete_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Messages ---

@router.get(
    "/conversations/{conversation_id}/messages",
    summary="List messages in a conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_messages(
    conversation_id: str,
    page: Optional[int] = Query(None, description="Page number"),
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)
    params = {}
    if page:
        params["page"] = page

    result = await messaging_service.get_messages(tenant_id, conversation_id, params or None)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/messages",
    summary="Send a message",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.send_message(
        tenant_id,
        conversation_id,
        payload.model_dump(),
        user_id=current_user.auth0_user_id,
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Assignments ---

@router.post(
    "/conversations/{conversation_id}/assign",
    summary="Assign conversation to agent or team",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def assign_conversation(
    conversation_id: str,
    payload: AssignConversationRequest,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.assign_conversation(
        tenant_id, conversation_id, payload.model_dump(exclude_none=True)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/conversations/{conversation_id}/unassign",
    summary="Remove assignment from conversation",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def unassign_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.unassign_conversation(tenant_id, conversation_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Inboxes ---

@router.get(
    "/inboxes",
    summary="List inboxes",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_inboxes(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.get_inboxes(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Contacts ---

@router.get(
    "/contacts",
    summary="List contacts",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_contacts(
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    page: Optional[int] = Query(None, description="Page number"),
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

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
    summary="List canned responses",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_canned_responses(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.get_canned_responses(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Teams ---

@router.get(
    "/teams",
    summary="List teams",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_teams(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.get_teams(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- Notifications ---

@router.get(
    "/notifications",
    summary="List notifications",
    tags=["messaging"],
    responses={503: {"model": MessagingError}},
)
async def list_notifications(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.get_notifications(
        tenant_id, current_user.auth0_user_id
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


# --- WhatsApp ---


@router.post(
    "/whatsapp/connect",
    summary="Connect WhatsApp via embedded signup",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def connect_whatsapp(
    payload: WhatsAppConnectRequest,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.whatsapp_connect(
        tenant_id, payload.model_dump(exclude_none=True)
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/whatsapp/status",
    summary="List connected WhatsApp channels",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def whatsapp_status(
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.whatsapp_status(tenant_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.get(
    "/whatsapp/health/{inbox_id}",
    summary="Get WhatsApp channel health status",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def whatsapp_health(
    inbox_id: str,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

    result = await messaging_service.whatsapp_health(tenant_id, inbox_id)
    if result is None:
        raise HTTPException(status_code=503, detail="Messaging service unavailable")

    return result


@router.post(
    "/whatsapp/manual-connect",
    summary="Connect WhatsApp with manual credentials",
    tags=["messaging", "whatsapp"],
    responses={503: {"model": MessagingError}},
)
async def manual_connect_whatsapp(
    payload: ManualWhatsAppRequest,
    current_user: User = Depends(get_current_user),
):
    tenant_id = _get_tenant_id(current_user)

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
