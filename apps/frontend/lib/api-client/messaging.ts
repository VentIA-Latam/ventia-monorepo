import { apiGet, apiPost } from "./client";
import type {
  ConversationListResponse,
  Conversation,
  MessageListResponse,
  WebSocketToken,
  Inbox,
  CannedResponse,
  Team,
  SendMessagePayload,
  AssignConversationPayload,
  WhatsAppConnectParams,
  WhatsAppConnectResponse,
} from "@/lib/types/messaging";

export async function getConversations(params?: {
  status?: string;
  page?: number;
}): Promise<ConversationListResponse> {
  return apiGet("/api/messaging/conversations", params as Record<string, string | number>);
}

export async function getConversation(id: string): Promise<Conversation> {
  return apiGet(`/api/messaging/conversations/${id}`);
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
  payload: SendMessagePayload
): Promise<unknown> {
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

export async function connectWhatsApp(
  params: WhatsAppConnectParams
): Promise<WhatsAppConnectResponse> {
  return apiPost("/api/messaging/whatsapp/connect", params);
}
