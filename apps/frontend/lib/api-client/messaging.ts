import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "./client";
import type {
  ConversationListResponse,
  ConversationCounts,
  Conversation,
  MessageListResponse,
  MessageSearchResponse,
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
  TemperatureDefinition,
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
  search?: string;
  tenant_id?: number;
}

export async function getConversations(
  params?: ConversationFilters,
  signal?: AbortSignal,
): Promise<ConversationListResponse> {
  return apiGet("/api/messaging/conversations", params as Record<string, string | number>, { signal });
}

export async function exportConversations(params?: ConversationFilters): Promise<void> {
  const result = await apiGet<{ success: boolean; data: { name: string | null; phone: string | null }[] }>(
    "/api/messaging/conversations/export",
    params as Record<string, string | number>,
  );
  const escape = (val: string | null | undefined) => {
    const str = val ?? "";
    return str.includes(";") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const rows = [
    ["Nombre", "Teléfono"],
    ...(result.data ?? []).map((r) => [escape(r.name), escape(r.phone)]),
  ];
  const csv = rows.map((r) => r.join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conversaciones-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getConversation(id: number | string, tenantId?: number): Promise<Conversation> {
  const resp = await apiGet<{ success: boolean; data: Conversation }>(
    `/api/messaging/conversations/${id}`,
    tenantId ? { tenant_id: tenantId } : undefined,
  );
  return resp.data;
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
  stage: "pre_sale" | "sale",
  tenantId?: number
): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/conversations/${id}/stage${qs}`, { stage });
}

export async function escalateConversation(
  id: number | string,
  tenantId?: number
): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/conversations/${id}/escalate${qs}`, {});
}

export async function resolveEscalationConversation(
  id: number | string,
  tenantId?: number
): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/conversations/${id}/resolve-escalation${qs}`, {});
}

export async function markConversationRead(conversationId: number | string, tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/conversations/${conversationId}/read${qs}`);
}

export async function getMessages(
  conversationId: number | string,
  options?: { before?: number; after?: number; tenantId?: number; signal?: AbortSignal }
): Promise<MessageListResponse> {
  const params: Record<string, string | number> = {};
  if (options?.before) params.before = options.before;
  if (options?.after) params.after = options.after;
  if (options?.tenantId) params.tenant_id = options.tenantId;
  return apiGet(
    `/api/messaging/conversations/${conversationId}/messages`,
    Object.keys(params).length > 0 ? params : undefined,
    options?.signal ? { signal: options.signal } : undefined
  );
}

export async function searchMessages(
  conversationId: number | string,
  query: string,
  tenantId?: number
): Promise<MessageSearchResponse> {
  const params: Record<string, string | number> = { q: query };
  if (tenantId) params.tenant_id = tenantId;
  return apiGet(`/api/messaging/conversations/${conversationId}/messages/search`, params);
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

export async function getCannedResponses(tenantId?: number): Promise<CannedResponse[]> {
  return apiGet("/api/messaging/canned-responses", tenantId ? { tenant_id: tenantId } : undefined);
}


// --- Labels ---

export async function getLabels(tenantId?: number): Promise<{ success: boolean; data: Label[] }> {
  return apiGet("/api/messaging/labels", tenantId ? { tenant_id: tenantId } : undefined);
}

export async function createLabel(payload: { title: string; color: string }, tenantId?: number): Promise<unknown> {
  const params = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/labels${params}`, payload);
}

export async function deleteLabel(id: number | string, tenantId?: number): Promise<unknown> {
  const params = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiDelete(`/api/messaging/labels/${id}${params}`);
}

export async function addConversationLabel(conversationId: number | string, labelId: number | string, tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/conversations/${conversationId}/labels${qs}`, { label_id: labelId });
}

export async function removeConversationLabel(conversationId: number | string, labelId: number | string, tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiDelete(`/api/messaging/conversations/${conversationId}/labels/${labelId}${qs}`);
}

// --- Temperature config ---

export async function getTemperatureConfig(tenantId?: number): Promise<{ success: boolean; data: TemperatureDefinition[] }> {
  return apiGet("/api/messaging/temperature-config", tenantId ? { tenant_id: tenantId } : undefined);
}

export async function updateTemperatureConfig(
  config: TemperatureDefinition[],
  tenantId?: number
): Promise<{ success: boolean; data: TemperatureDefinition[] }> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPut(`/api/messaging/temperature-config${qs}`, { temperature_config: config });
}

// --- User sync ---

export async function syncUser(tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/users/sync${qs}`);
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

export async function getWhatsAppStatus(tenantId?: number): Promise<{ success: boolean; data: WhatsAppChannel[] }> {
  return apiGet("/api/messaging/whatsapp/status", tenantId ? { tenant_id: tenantId } : undefined);
}

// --- WhatsApp Templates ---

export async function getTemplates(
  inboxId: number | string,
  tenantId?: number
): Promise<{ success: boolean; data: WhatsAppTemplate[] }> {
  return apiGet(`/api/messaging/inboxes/${inboxId}/templates`, tenantId ? { tenant_id: tenantId } : undefined);
}

export async function syncTemplates(inboxId: number | string, tenantId?: number): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(`/api/messaging/inboxes/${inboxId}/templates${qs}`);
}

export async function sendTemplateMessage(
  conversationId: number | string,
  payload: SendTemplatePayload,
  tenantId?: number
): Promise<unknown> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return apiPost(
    `/api/messaging/conversations/${conversationId}/messages/template${qs}`,
    payload
  );
}
