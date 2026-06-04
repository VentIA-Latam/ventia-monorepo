import { cache } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchWithAuth<T>(
  endpoint: string,
  accessToken: string,
  params?: Record<string, string | number>
): Promise<T> {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
  }

  const url = `${API_URL}/messaging${endpoint}${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger auto-provisioning by calling ws-token endpoint.
 * Creates Account + User + AccountUser in messaging if missing.
 */
export async function ensureMessagingProvisioned(accessToken: string): Promise<void> {
  const url = `${API_URL}/messaging/ws-token`;
  await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

export async function fetchConversations(
  accessToken: string,
  params?: Record<string, string | number>
) {
  return fetchWithAuth<{ success: boolean; data: unknown[]; meta: unknown }>(
    "/conversations",
    accessToken,
    params as Record<string, string | number>
  );
}

export const fetchInboxes = cache(async (accessToken: string) => {
  return fetchWithAuth<unknown[]>("/inboxes", accessToken);
});

export const fetchInboxTemplates = cache(async (accessToken: string, inboxId: number) => {
  return fetchWithAuth<{ success: boolean; data: unknown[] }>(
    `/inboxes/${inboxId}/templates`,
    accessToken
  );
});

export const fetchLabels = cache(async (accessToken: string) => {
  return fetchWithAuth<{ success: boolean; data: unknown[] }>("/labels", accessToken);
});

export const fetchTemperatureConfig = cache(async (accessToken: string) => {
  return fetchWithAuth<{ success: boolean; data: unknown[] }>("/temperature-config", accessToken);
});

export const fetchWhatsAppStatus = cache(async (accessToken: string) => {
  return fetchWithAuth<{ success: boolean; data: import("@/lib/types/messaging").WhatsAppChannel[] }>(
    "/whatsapp/status",
    accessToken
  );
});

export const fetchInstagramStatus = cache(async (accessToken: string) => {
  return fetchWithAuth<{ success: boolean; data: import("@/lib/types/messaging").InstagramChannel[] }>(
    "/instagram/status",
    accessToken
  );
});
