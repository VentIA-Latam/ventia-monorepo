import type { APIRequestContext, Page } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * Helpers para Module 7 (contact edit + notes). Mismo patrón que campaigns-api.ts:
 * usan el accessToken de Auth0 que el frontend expone vía `/api/auth/token`.
 *
 * Usados para:
 *  - Snapshot del estado original del contacto (nombre, email, phone) antes de editar.
 *  - Restaurar ese estado en `afterEach` para mantener los specs idempotentes.
 *  - Listar / borrar notas creadas durante el test (matcheadas por prefix).
 */

export interface ContactSnapshot {
  id: number;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  identifier: string | null;
}

export interface NoteSummary {
  id: number;
  content: string;
}

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

/** Lookup contact por phone exacto. Devuelve el id + datos básicos o null. */
export async function findContactByPhone(
  request: APIRequestContext,
  token: string,
  phone: string
): Promise<ContactSnapshot | null> {
  const res = await request.get(
    `${BACKEND_URL}/api/v1/messaging/contacts?search=${encodeURIComponent(phone)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok()) return null;
  const body = await res.json();
  const data = Array.isArray(body) ? body : (body.data ?? []);
  const match = data.find(
    (c: { phone_number?: string | null }) => c.phone_number === phone
  );
  if (!match) return null;
  return {
    id: match.id,
    name: match.name ?? null,
    phone_number: match.phone_number ?? null,
    email: match.email ?? null,
    identifier: match.identifier ?? null,
  };
}

/**
 * Restaura los campos editables del contacto a un snapshot previo.
 * Idempotente: si el campo ya tiene ese valor, Rails responde 200 igual.
 */
export async function restoreContact(
  request: APIRequestContext,
  token: string,
  snapshot: ContactSnapshot
): Promise<void> {
  const res = await request.patch(
    `${BACKEND_URL}/api/v1/messaging/contacts/${snapshot.id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: snapshot.name ?? "",
        email: snapshot.email ?? "",
        phone_number: snapshot.phone_number ?? "",
      },
    }
  );
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`restoreContact failed: ${res.status()} — ${body}`);
  }
}

export async function listContactNotes(
  request: APIRequestContext,
  token: string,
  contactId: number
): Promise<NoteSummary[]> {
  const res = await request.get(
    `${BACKEND_URL}/api/v1/messaging/contacts/${contactId}/notes`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok()) return [];
  const body = await res.json();
  const data: NoteSummary[] = Array.isArray(body) ? body : (body.data ?? []);
  return data.map((n) => ({ id: n.id, content: n.content }));
}

export async function deleteContactNote(
  request: APIRequestContext,
  token: string,
  contactId: number,
  noteId: number
): Promise<void> {
  const res = await request.delete(
    `${BACKEND_URL}/api/v1/messaging/contacts/${contactId}/notes/${noteId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`deleteContactNote failed: ${res.status()}`);
  }
}

/**
 * Borra todas las notas del contacto cuyo content empiece con el prefix dado.
 * Sirve para limpieza post-test (cada test prefiyea sus notas con E2E_NOTE_PREFIX).
 */
export async function deleteNotesByPrefix(
  request: APIRequestContext,
  token: string,
  contactId: number,
  prefix: string
): Promise<number> {
  const notes = await listContactNotes(request, token, contactId);
  let deleted = 0;
  for (const n of notes) {
    if (n.content.startsWith(prefix)) {
      await deleteContactNote(request, token, contactId, n.id);
      deleted++;
    }
  }
  return deleted;
}

/** Prefix para notas creadas en tests E2E — el cleanup matchea por acá. */
export const E2E_NOTE_PREFIX = "E2E-test-";

export function makeTestNoteContent(scenario: string): string {
  return `${E2E_NOTE_PREFIX}${scenario}-${Date.now()}`;
}
