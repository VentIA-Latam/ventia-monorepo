// --- Nested models ---

export interface ContactBrief {
  id: string;
  name: string | null;
  phone_number: string | null;
  email: string | null;
}

export interface AgentBrief {
  id: string;
  name: string | null;
  email: string | null;
}

export interface TeamBrief {
  id: string;
  name: string;
}

export interface AttachmentBrief {
  id: string;
  file_type: string | null;
  file_url: string | null;
  filename: string | null;
}

// --- Conversation ---

export type ConversationStatus = "open" | "resolved" | "pending";

export interface Conversation {
  id: string;
  status: ConversationStatus;
  inbox_id: string | null;
  contact: ContactBrief | null;
  assignee: AgentBrief | null;
  team: TeamBrief | null;
  ai_agent_enabled: boolean;
  can_reply: boolean;
  messages_count: number | null;
  last_message_at: string | number | null;
  created_at: string | number | null;
}

export interface ConversationListResponse {
  success: boolean;
  data: Conversation[];
  meta: { all_count?: number; page?: number } | null;
}

// --- Message ---

export type MessageType = "incoming" | "outgoing" | "activity" | "template";

export interface Message {
  id: string;
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
  id: string;
  name: string | null;
  channel_type: string | null;
}

// --- Canned Response ---

export interface CannedResponse {
  id: string;
  short_code: string;
  content: string;
}

// --- Team ---

export interface Team {
  id: string;
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
  message_type?: string;
}

export interface AssignConversationPayload {
  assignee_id?: string;
  team_id?: string;
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
    channel_id: string;
    phone_number: string;
    inbox_id: string;
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
