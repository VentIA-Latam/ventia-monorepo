"""
Pydantic schemas for the messaging service API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# --- Temperature config models ---

class TemperatureConfigItem(BaseModel):
    key: str
    name: str
    color: str
    icon: str
    position: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TemperatureConfigResponse(BaseModel):
    success: bool = True
    data: list[TemperatureConfigItem] = []


# --- Nested models ---

class ContactBrief(BaseModel):
    id: int
    type: Optional[str] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    identifier: Optional[str] = None
    whatsapp_bsuid: Optional[str] = None
    email: Optional[str] = None
    last_activity_at: Optional[datetime] = None


class UserBrief(BaseModel):
    id: int
    type: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None


class TeamBrief(BaseModel):
    id: int
    name: str


class AttachmentBrief(BaseModel):
    id: int
    file_type: Optional[str] = None
    file_url: Optional[str] = None
    data_url: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None
    extension: Optional[str] = None
    coordinates_lat: Optional[float] = None
    coordinates_long: Optional[float] = None
    meta: Optional[dict] = None


# --- Response models ---

class LastMessageBrief(BaseModel):
    content: Optional[str] = None
    message_type: Optional[str] = None
    status: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InboxBrief(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    channel_type: Optional[str] = None

    class Config:
        from_attributes = True


class ContactDetails(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    phone_number: Optional[str] = None
    identifier: Optional[str] = None
    whatsapp_bsuid: Optional[str] = None
    email: Optional[str] = None
    last_activity_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContactsListResponse(BaseModel):
    success: bool = True
    data: list[ContactDetails] = []


class LabelBrief(BaseModel):
    id: int
    title: str
    color: str
    system: Optional[bool] = False

    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: int
    uuid: Optional[str] = None
    status: str
    stage: str
    priority: str
    ai_agent_enabled: Optional[bool] = None
    can_reply: Optional[bool] = None
    temperature: Optional[str] = None
    last_activity_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    agent_last_seen_at: Optional[datetime] = None
    waiting_since: Optional[int] = None
    first_reply_created_at: Optional[int] = None
    created_at: Optional[datetime] = None
    messages_count: Optional[int] = None
    unread_count: Optional[int] = None
    contact: Optional[ContactBrief] = None
    inbox_id: Optional[int] = None
    inbox: Optional[InboxBrief] = None
    assignee: Optional[UserBrief] = None
    team: Optional[TeamBrief] = None
    labels: list[LabelBrief] = []
    last_message: Optional[LastMessageBrief] = None

    class Config:
        from_attributes = True


class ConversationListMeta(BaseModel):
    current_page: int
    total_pages: int
    total_count: int


class ConversationListResponse(BaseModel):
    success: bool = True
    data: list[ConversationListItem] = []
    meta: Optional[ConversationListMeta] = None


class ConversationCountsData(BaseModel):
    all: int
    sale: int
    unattended: int


class ConversationCountsResponse(BaseModel):
    success: bool = True
    data: ConversationCountsData


class ConversationDetailResponse(BaseModel):
    success: bool = True
    data: dict  # Full conversation details from Rails

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    status: str
    inbox_id: Optional[int] = None
    contact: Optional[ContactBrief] = None
    assignee: Optional[UserBrief] = None
    team: Optional[TeamBrief] = None
    messages_count: Optional[int] = None
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    content: Optional[str] = None
    message_type: Optional[str] = None
    content_type: Optional[str] = None
    content_attributes: Optional[dict] = None
    status: Optional[str] = None
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
    id: int
    name: Optional[str] = None
    channel_type: Optional[str] = None


class CannedResponseResponse(BaseModel):
    id: int
    short_code: str
    content: str


class CannedResponsesListResponse(BaseModel):
    success: bool = True
    data: list[CannedResponseResponse] = []


class TeamResponse(BaseModel):
    id: int
    name: str
    members_count: Optional[int] = None


class NotificationResponse(BaseModel):
    id: int
    notification_type: Optional[str] = None
    primary_actor_type: Optional[str] = None
    primary_actor_id: Optional[int] = None
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class WebSocketTokenResponse(BaseModel):
    pubsub_token: str
    account_id: int
    user_id: int


# --- Request models ---

class SendMessageRequest(BaseModel):
    content: Optional[str] = None
    content_type: Optional[str] = None
    content_attributes: Optional[dict] = None


class TemplateParamsRequest(BaseModel):
    name: str
    namespace: Optional[str] = None
    language: str
    processed_params: Optional[dict] = None


class SendTemplateMessageRequest(BaseModel):
    content: str
    template_params: TemplateParamsRequest


class AssignConversationRequest(BaseModel):
    assignee_id: Optional[str] = None
    team_id: Optional[str] = None


class UserSyncRequest(BaseModel):
    name: str
    email: str
    ventia_user_id: int
    role: str = "agent"


class UserDetailedBrief(BaseModel):
    id: int
    name: str
    email: str
    avatar_url: Optional[str] = None
    ventia_user_id: int
    pubsub_token: str
    type: str

    class Config:
        from_attributes = True


class AccountUserNested(BaseModel):
    id: int
    role: str
    availability: str
    user_id: int
    user: UserDetailedBrief

    class Config:
        from_attributes = True


class UserSyncResponse(BaseModel):
    user: UserDetailedBrief
    account_user: AccountUserNested

    class Config:
        from_attributes = True


class AccountResponse(BaseModel):
    id: int
    name: str
    ventia_tenant_id: int
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


# --- Push tokens ---

class PushTokenRequest(BaseModel):
    token: str
    platform: str = "web"
    device_info: Optional[dict] = None


# --- Notification settings ---

class NotificationSettingsPayload(BaseModel):
    human_support: Optional[bool] = None
    payment_review: Optional[bool] = None
    message_ai_off: Optional[bool] = None
    message_ai_on: Optional[bool] = None


# --- Messages Response ---

class SendMessageResponse(BaseModel):
    success: bool = True
    message: str = "Message sent"
    data: MessageResponse

    class Config:
        from_attributes = True


# --- Inboxes Response ---

class InboxItem(BaseModel):
    id: int
    name: Optional[str] = None
    channel_type: Optional[str] = None
    channel_id: Optional[int] = None
    account_id: Optional[int] = None
    greeting_enabled: Optional[bool] = None
    greeting_message: Optional[str] = None
    enable_auto_assignment: Optional[bool] = None
    auto_assignment_config: Optional[dict] = None
    allow_messages_after_resolved: Optional[bool] = None
    lock_to_single_conversation: Optional[bool] = None
    working_hours_enabled: Optional[bool] = None
    out_of_office_message: Optional[str] = None
    timezone: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InboxListResponse(BaseModel):
    success: bool = True
    data: list[InboxItem] = []


class TeamsListResponse(BaseModel):
    success: bool = True
    data: list[TeamResponse] = []


class TemplateComponent(BaseModel):
    text: Optional[str] = None
    type: Optional[str] = None
    format: Optional[str] = None


class TemplateItem(BaseModel):
    id: str
    name: str
    status: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    components: Optional[list[TemplateComponent]] = None
    parameter_format: Optional[str] = None
    previous_category: Optional[str] = None
    is_primary_device_delivery_only: Optional[bool] = None

    class Config:
        from_attributes = True


class InboxTemplatesResponse(BaseModel):
    success: bool = True
    data: list[TemplateItem] = []


# --- Labels Response ---

class LabelsListResponse(BaseModel):
    success: bool = True
    data: list[LabelBrief] = []


class SingleLabelResponse(BaseModel):
    success: bool = True
    message: str
    data: LabelBrief

    class Config:
        from_attributes = True


class ConversationLabelsListResponse(BaseModel):
    success: bool = True
    data: list[LabelBrief] = []


# --- WhatsApp Response ---

class WhatsAppChannel(BaseModel):
    id: int
    phone_number: str
    provider: str
    inbox_id: int
    inbox_name: str
    templates_count: int
    last_template_sync: Optional[datetime] = None
    reauthorization_required: bool = False

    class Config:
        from_attributes = True


class WhatsAppStatusResponse(BaseModel):
    success: bool = True
    data: list[WhatsAppChannel] = []


class WhatsAppThroughput(BaseModel):
    level: str


class WhatsAppHealthData(BaseModel):
    display_phone_number: str
    verified_name: str
    name_status: str
    quality_rating: str
    messaging_limit_tier: Optional[str] = None
    account_mode: str
    code_verification_status: str
    throughput: WhatsAppThroughput
    last_onboarded_time: Optional[datetime] = None
    platform_type: str
    business_id: str

    class Config:
        from_attributes = True


class WhatsAppHealthResponse(BaseModel):
    success: bool = True
    data: WhatsAppHealthData


# --- Notifications Response ---

class NotificationItem(BaseModel):
    id: int
    notification_type: Optional[str] = None
    primary_actor_type: Optional[str] = None
    primary_actor_id: Optional[int] = None
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationsResponse(BaseModel):
    success: bool = True
    data: list[NotificationItem] = []


# --- Notification Settings Response ---

class PushFlags(BaseModel):
    human_support: bool = True
    payment_review: bool = True
    message_ai_off: bool = True
    message_ai_on: bool = False


class NotificationSettingsData(BaseModel):
    push_flags: PushFlags


class NotificationSettingsResponse(BaseModel):
    success: bool = True
    data: NotificationSettingsData

    class Config:
        from_attributes = True


# --- Generic Success Response ---

class SuccessMessageResponse(BaseModel):
    success: bool = True
    message: str = "Operation successful"

    class Config:
        from_attributes = True


# --- Error models ---

class MessagingError(BaseModel):
    error: str
    detail: Optional[str] = None
