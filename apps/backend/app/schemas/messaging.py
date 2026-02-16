"""
Pydantic schemas for the messaging service API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Nested models ---

class ContactBrief(BaseModel):
    id: str
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None


class UserBrief(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None


class TeamBrief(BaseModel):
    id: str
    name: str


class AttachmentBrief(BaseModel):
    id: str
    file_type: Optional[str] = None
    file_url: Optional[str] = None
    filename: Optional[str] = None


# --- Response models ---

class ConversationResponse(BaseModel):
    id: str
    status: str
    inbox_id: Optional[str] = None
    contact: Optional[ContactBrief] = None
    assignee: Optional[UserBrief] = None
    team: Optional[TeamBrief] = None
    messages_count: Optional[int] = None
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    success: bool = True
    data: list[ConversationResponse] = []
    meta: Optional[dict] = None


class MessageResponse(BaseModel):
    id: str
    content: Optional[str] = None
    message_type: Optional[str] = None
    sender: Optional[UserBrief | ContactBrief] = None
    attachments: list[AttachmentBrief] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    success: bool = True
    data: list[MessageResponse] = []
    meta: Optional[dict] = None


class InboxResponse(BaseModel):
    id: str
    name: Optional[str] = None
    channel_type: Optional[str] = None


class CannedResponseResponse(BaseModel):
    id: str
    short_code: str
    content: str


class TeamResponse(BaseModel):
    id: str
    name: str
    members_count: Optional[int] = None


class NotificationResponse(BaseModel):
    id: str
    notification_type: Optional[str] = None
    primary_actor_type: Optional[str] = None
    primary_actor_id: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class WebSocketTokenResponse(BaseModel):
    pubsub_token: str
    account_id: str
    user_id: str


# --- Request models ---

class SendMessageRequest(BaseModel):
    content: str
    content_type: Optional[str] = None


class AssignConversationRequest(BaseModel):
    assignee_id: Optional[str] = None
    team_id: Optional[str] = None


class UserSyncRequest(BaseModel):
    name: str
    email: str
    ventia_user_id: str
    role: str = "agent"


class AccountResponse(BaseModel):
    id: str
    name: str
    ventia_tenant_id: str
    status: Optional[str] = None


# --- WhatsApp models ---

class WhatsAppConnectRequest(BaseModel):
    code: str
    business_id: str
    waba_id: str
    phone_number_id: Optional[str] = None


class ManualWhatsAppRequest(BaseModel):
    name: Optional[str] = None
    phone_number: str
    api_key: str
    phone_number_id: str
    business_account_id: str


# --- Error models ---

class MessagingError(BaseModel):
    error: str
    detail: Optional[str] = None
