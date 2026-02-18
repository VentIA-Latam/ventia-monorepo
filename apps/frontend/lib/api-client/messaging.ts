import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type {
  ConversationListResponse,
  Conversation,
  MessageListResponse,
  WebSocketToken,
  Inbox,
  Label,
  CannedResponse,
  Team,
  SendMessagePayload,
  AssignConversationPayload,
  WhatsAppConnectParams,
  WhatsAppConnectResponse,
  ManualWhatsAppConnectParams,
} from "@/lib/types/messaging";

export interface ConversationFilters {
  status?: string;
  page?: number;
  label?: string;
  temperature?: string;
  created_after?: string;
  created_before?: string;
  unread?: string;
}

export async function getConversations(params?: ConversationFilters): Promise<ConversationListResponse> {
  return apiGet("/api/messaging/conversations", params as Record<string, string | number>);
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiGet(`/api/messaging/conversations/${id}`);
}

export async function updateConversation(
  id: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  return apiPatch(`/api/messaging/conversations/${id}`, payload);
}

export async function deleteConversation(id: string): Promise<unknown> {
  return apiDelete(`/api/messaging/conversations/${id}`);
}

export async function getMessages(
  conversationId: string,
  page?: number
): Promise<MessageListResponse> {
  return apiGet(
    `/api/messaging/conversations/${conversationId}/messages`,
    page ? { page } : undefined
  );
}

export async function sendMessage(
  conversationId: string,
  payload: SendMessagePayload,
  file?: File
): Promise<unknown> {
  if (file) {
    const formData = new FormData();
    formData.append("content", payload.content || "");
    formData.append("file", file);

    const response = await fetch(
      `/api/messaging/conversations/${conversationId}/messages`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  return apiPost(`/api/messaging/conversations/${conversationId}/messages`, payload);
}

export async function assignConversation(
  conversationId: string,
  payload: AssignConversationPayload
): Promise<unknown> {
  return apiPost(`/api/messaging/conversations/${conversationId}/assign`, payload);
}

export async function unassignConversation(conversationId: string): Promise<unknown> {
  return apiPost(`/api/messaging/conversations/${conversationId}/unassign`);
}

export async function getWsToken(): Promise<WebSocketToken> {
  return apiGet("/api/messaging/ws-token");
}

export async function getInboxes(): Promise<Inbox[]> {
  return apiGet("/api/messaging/inboxes");
}

export async function getCannedResponses(): Promise<CannedResponse[]> {
  return apiGet("/api/messaging/canned-responses");
}

export async function getTeams(): Promise<Team[]> {
  return apiGet("/api/messaging/teams");
}

// --- Labels ---

export async function getLabels(): Promise<{ success: boolean; data: Label[] }> {
  return apiGet("/api/messaging/labels");
}

export async function createLabel(payload: { title: string; color: string }): Promise<unknown> {
  return apiPost("/api/messaging/labels", payload);
}

export async function addConversationLabel(conversationId: string, labelId: string): Promise<unknown> {
  return apiPost(`/api/messaging/conversations/${conversationId}/labels`, { label_id: labelId });
}

export async function removeConversationLabel(conversationId: string, labelId: string): Promise<unknown> {
  return apiDelete(`/api/messaging/conversations/${conversationId}/labels/${labelId}`);
}

// --- WhatsApp ---

export async function connectWhatsApp(
  params: WhatsAppConnectParams
): Promise<WhatsAppConnectResponse> {
  return apiPost("/api/messaging/whatsapp/connect", params);
}

export async function connectWhatsAppManually(
  params: ManualWhatsAppConnectParams
): Promise<unknown> {
  return apiPost("/api/messaging/whatsapp/manual-connect", params);
}
