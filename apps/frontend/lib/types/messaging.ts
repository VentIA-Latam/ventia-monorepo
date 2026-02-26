// --- Nested models ---

export interface ContactBrief {
  id: number;
  name: string | null;
  phone_number: string | null;
  email: string | null;
}

export interface AgentBrief {
  id: number;
  name: string | null;
  email: string | null;
}

export interface TeamBrief {
  id: number;
  name: string;
}

export interface AttachmentBrief {
  id: string | number;
  file_type: string | null;
  file_url: string | null;
  data_url?: string | null;
  filename: string | null;
  file_size?: number | null;
  extension?: string | null;
  coordinates_lat?: number | null;
  coordinates_long?: number | null;
  meta?: Record<string, unknown> | null;
}

// --- Label ---

export interface Label {
  id: number;
  title: string;
  color: string;
  system?: boolean;
}

// --- Conversation ---

export type ConversationStatus = "open" | "resolved" | "pending";
export type ConversationStage = "pre_sale" | "sale";
export type ConversationTemperature = "cold" | "warm" | "hot" | null;

export interface LastMessageBrief {
  content: string | null;
  message_type: MessageType | null;
  attachment_type: string | null;
  created_at: string | number | null;
}

export interface InboxBrief {
  id: number;
  name: string | null;
  channel_type: string | null;
}

export interface Conversation {
  id: number;
  status: ConversationStatus;
  stage: ConversationStage;
  inbox_id: number | null;
  inbox: InboxBrief | null;
  contact: ContactBrief | null;
  assignee: AgentBrief | null;
  team: TeamBrief | null;
  ai_agent_enabled: boolean;
  can_reply: boolean;
  temperature: ConversationTemperature;
  labels: Label[];
  messages_count: number | null;
  unread_count: number | null;
  agent_last_seen_at: string | number | null;
  waiting_since: number | null;
  first_reply_created_at: number | null;
  last_message_at: string | number | null;
  last_message: LastMessageBrief | null;
  created_at: string | number | null;
}

export interface ConversationCounts {
  all: number;
  sale: number;
  unattended: number;
}

export interface ConversationListResponse {
  success: boolean;
  data: Conversation[];
  meta: { all_count?: number; page?: number } | null;
}

// --- Message ---

export type MessageType = "incoming" | "outgoing" | "activity" | "template";

export interface Message {
  id: string | number;
  content: string | null;
  message_type: MessageType | null;
  sender: AgentBrief | ContactBrief | null;
  attachments: AttachmentBrief[];
  created_at: string | number | null;
}

export interface MessageListResponse {
  success: boolean;
  data: Message[];
  meta: Record<string, unknown> | null;
}

// --- Inbox ---

export interface Inbox {
  id: number;
  name: string | null;
  channel_type: string | null;
}

// --- Canned Response ---

export interface CannedResponse {
  id: number;
  short_code: string;
  content: string;
}

// --- Team ---

export interface Team {
  id: number;
  name: string;
  members_count: number | null;
}

// --- WebSocket ---

export interface WebSocketToken {
  pubsub_token: string;
  account_id: string;
  user_id: string;
}

// --- Request payloads ---

export interface SendMessagePayload {
  content: string;
  content_type?: string;
}

export interface AssignConversationPayload {
  assignee_id?: number;
  team_id?: number;
}

// --- WhatsApp Templates ---

export interface WhatsAppTemplateButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY" | "COPY_CODE";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsAppTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  namespace?: string;
  parameter_format?: string;
  components: WhatsAppTemplateComponent[];
}

export interface TemplateParams {
  name: string;
  namespace?: string;
  language: string;
  processed_params: Record<string, unknown>;
}

export interface SendTemplatePayload {
  content: string;
  template_params: TemplateParams;
}

// --- WhatsApp Connect ---

export interface WhatsAppConnectParams {
  code: string;
  business_id: string;
  waba_id: string;
  phone_number_id?: string;
}

export interface WhatsAppConnectResponse {
  success: boolean;
  data: {
    channel_id: number;
    phone_number: string;
    inbox_id: number;
    inbox_name: string;
  };
  message: string;
}

export interface ManualWhatsAppConnectParams {
  name?: string;
  phone_number: string;
  api_key: string;
  phone_number_id: string;
  business_account_id: string;
}
