import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type {
  ConversationListResponse,
  ConversationCounts,
  Conversation,
  MessageListResponse,
  WebSocketToken,
  Inbox,
  Label,
  CannedResponse,
  SendMessagePayload,
  SendTemplatePayload,
  WhatsAppConnectParams,
  WhatsAppConnectResponse,
  ManualWhatsAppConnectParams,
  WhatsAppTemplate,
  WhatsAppChannel,
} from "@/lib/types/messaging";

export interface ConversationFilters {
  status?: string;
  stage?: string;
  conversation_type?: string;
  page?: number;
  label?: string;
  temperature?: string;
  created_after?: string;
  created_before?: string;
  unread?: string;
  tenant_id?: number;
}

export async function getConversations(params?: ConversationFilters): Promise<ConversationListResponse> {
  return apiGet("/api/messaging/conversations", params as Record<string, string | number>);
}

export async function getConversation(id: number | string, tenantId?: number): Promise<Conversation> {
  return apiGet(`/api/messaging/conversations/${id}`, tenantId ? { tenant_id: tenantId } : undefined);
}

export async function updateConversation(
  id: number | string,
  payload: Record<string, unknown>,
  tenantId?: number
): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPatch(`/api/messaging/conversations/${id}${qs}`, payload);
}

export async function deleteConversation(id: number | string, tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiDelete(`/api/messaging/conversations/${id}${qs}`);
}

export async function getConversationCounts(tenantId?: number): Promise<{ success: boolean; data: ConversationCounts }> {
  return apiGet("/api/messaging/conversations/counts", tenantId ? { tenant_id: tenantId } : undefined);
}

export async function updateConversationStage(
  id: number | string,
  stage: "pre_sale" | "sale"
): Promise<unknown> {
  return apiPost(`/api/messaging/conversations/${id}/stage`, { stage });
}

export async function markConversationRead(conversationId: number | string, tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/conversations/${conversationId}/read${qs}`);
}

export async function getMessages(
  conversationId: number | string,
  page?: number,
  tenantId?: number
): Promise<MessageListResponse> {
  const params: Record<string, string | number> = {};
  if (page) params.page = page;
  if (tenantId) params.tenant_id = tenantId;
  return apiGet(
    `/api/messaging/conversations/${conversationId}/messages`,
    Object.keys(params).length > 0 ? params : undefined
  );
}

export async function sendMessage(
  conversationId: number | string,
  payload: SendMessagePayload,
  file?: File,
  tenantId?: number
): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  if (file) {
    const formData = new FormData();
    formData.append("content", payload.content || "");
    formData.append("file", file);

    const response = await fetch(
      `/api/messaging/conversations/${conversationId}/messages${qs}`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  return apiPost(`/api/messaging/conversations/${conversationId}/messages${qs}`, payload);
}


export async function getWsToken(tenantId?: number): Promise<WebSocketToken> {
  return apiGet("/api/messaging/ws-token", tenantId ? { tenant_id: tenantId } : undefined);
}

export async function getInboxes(tenantId?: number): Promise<Inbox[]> {
  return apiGet("/api/messaging/inboxes", tenantId ? { tenant_id: tenantId } : undefined);
}

export async function getCannedResponses(): Promise<CannedResponse[]> {
  return apiGet("/api/messaging/canned-responses");
}


// --- Labels ---

export async function getLabels(tenantId?: number): Promise<{ success: boolean; data: Label[] }> {
  return apiGet("/api/messaging/labels", tenantId ? { tenant_id: tenantId } : undefined);
}

export async function createLabel(payload: { title: string; color: string }): Promise<unknown> {
  return apiPost("/api/messaging/labels", payload);
}

export async function deleteLabel(id: number | string): Promise<unknown> {
  return apiDelete(`/api/messaging/labels/${id}`);
}

export async function addConversationLabel(conversationId: number | string, labelId: number | string): Promise<unknown> {
  return apiPost(`/api/messaging/conversations/${conversationId}/labels`, { label_id: labelId });
}

export async function removeConversationLabel(conversationId: number | string, labelId: number | string): Promise<unknown> {
  return apiDelete(`/api/messaging/conversations/${conversationId}/labels/${labelId}`);
}

// --- User sync ---

export async function syncUser(): Promise<unknown> {
  return apiPost("/api/messaging/users/sync");
}

// --- WhatsApp ---

export async function connectWhatsApp(
  params: WhatsAppConnectParams
): Promise<WhatsAppConnectResponse> {
  return apiPost("/api/messaging/whatsapp/connect", params);
}

export async function connectWhatsAppManually(
  params: ManualWhatsAppConnectParams
): Promise<WhatsAppConnectResponse> {
  return apiPost("/api/messaging/whatsapp/manual-connect", params);
}

export async function getWhatsAppStatus(): Promise<{ success: boolean; data: WhatsAppChannel[] }> {
  return apiGet("/api/messaging/whatsapp/status");
}

// --- WhatsApp Templates ---

export async function getTemplates(
  inboxId: number | string
): Promise<{ success: boolean; data: WhatsAppTemplate[] }> {
  return apiGet(`/api/messaging/inboxes/${inboxId}/templates`);
}

export async function syncTemplates(inboxId: number | string): Promise<unknown> {
  return apiPost(`/api/messaging/inboxes/${inboxId}/templates`);
}

export async function sendTemplateMessage(
  conversationId: number | string,
  payload: SendTemplatePayload
): Promise<unknown> {
  return apiPost(
    `/api/messaging/conversations/${conversationId}/messages/template`,
    payload
  );
}
