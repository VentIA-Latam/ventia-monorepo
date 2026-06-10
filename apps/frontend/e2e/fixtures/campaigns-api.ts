import type { APIRequestContext, Page } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * Helpers que hablan con el backend directamente desde tests, usando el
 * accessToken que el frontend expone vía `/api/auth/token` (autenticado por la
 * sesión de Auth0 ya guardada en storageState).
 *
 * Usado para cleanup y setup determinista (crear/borrar campañas sin pasar por
 * la UI completa).
 */

export async function getAccessToken(page: Page): Promise<string> {
  const res = await page.request.get("/api/auth/token");
  if (!res.ok()) {
    throw new Error(
      `Failed to fetch access token: ${res.status()} ${res.statusText()}`
    );
  }
  const body = (await res.json()) as { accessToken?: string; error?: string };
  if (!body.accessToken) {
    throw new Error("No accessToken in /api/auth/token response: " + body.error);
  }
  return body.accessToken;
}

export async function fetchInboxes(
  request: APIRequestContext,
  token: string
): Promise<Array<{ id: number; name: string; channel_type?: string }>> {
  const res = await request.get(`${BACKEND_URL}/api/v1/messaging/inboxes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) throw new Error(`fetchInboxes failed: ${res.status()}`);
  const body = await res.json();
  const data = Array.isArray(body) ? body : body.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchLabels(
  request: APIRequestContext,
  token: string
): Promise<Array<{ id: number; title: string }>> {
  const res = await request.get(`${BACKEND_URL}/api/v1/messaging/labels`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) throw new Error(`fetchLabels failed: ${res.status()}`);
  const body = await res.json();
  const data = Array.isArray(body) ? body : body.data;
  return Array.isArray(data) ? data : [];
}

export async function createCampaign(
  request: APIRequestContext,
  token: string,
  payload: { title: string; inbox_id: number }
): Promise<{ id: number; title: string; campaign_status: string }> {
  const res = await request.post(`${BACKEND_URL}/api/v1/messaging/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`createCampaign failed: ${res.status()} — ${body}`);
  }
  const body = await res.json();
  return body.data ?? body;
}

export async function deleteCampaign(
  request: APIRequestContext,
  token: string,
  campaignId: number
): Promise<void> {
  const res = await request.delete(
    `${BACKEND_URL}/api/v1/messaging/campaigns/${campaignId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  // 404 = ya borrada (idempotente para cleanup).
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`deleteCampaign failed: ${res.status()}`);
  }
}

/**
 * Borra todas las campañas que matcheen un prefix de título. Útil para limpiar
 * artefactos de tests previos antes/después de cada spec.
 */
export async function deleteCampaignsByTitlePrefix(
  request: APIRequestContext,
  token: string,
  prefix: string
): Promise<number> {
  const res = await request.get(`${BACKEND_URL}/api/v1/messaging/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return 0;
  const body = await res.json();
  const data: Array<{ id: number; title: string }> = Array.isArray(body)
    ? body
    : (body.data ?? []);
  let deleted = 0;
  for (const c of data) {
    if (c.title?.startsWith(prefix)) {
      await deleteCampaign(request, token, c.id);
      deleted++;
    }
  }
  return deleted;
}

/** Prefix único para todos los tests del módulo — el cleanup matchea por acá. */
export const E2E_TITLE_PREFIX = "E2E-test-";

export function makeTestTitle(scenario: string): string {
  return `${E2E_TITLE_PREFIX}${scenario}-${Date.now()}`;
}
