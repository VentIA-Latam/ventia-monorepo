import { test, expect } from "../fixtures/pages.fixture";

/**
 * US-UX-002 — Reply citando mensajes (quoted message).
 *
 * Los mensajes se cargan client-side (message-view.tsx → /api/messaging/...), así que
 * page.route() SÍ los intercepta (a diferencia del listado, que es Server Component).
 * Mockeamos el GET (datos deterministas con una cita resuelta) y el POST (para no tocar
 * el backend real ni enviar a WhatsApp). Entramos a cualquier conversación del seed:
 * el mock reemplaza sus mensajes por los nuestros.
 */

const ORIGINAL = {
  id: 90001,
  source_id: "wamid.ORIGINAL",
  content: "¿Tienen stock del producto?",
  message_type: "incoming",
  content_type: "text",
  content_attributes: {},
  additional_attributes: null,
  status: "delivered",
  sender: { type: "contact", id: 7001, name: "Juan Pérez" },
  attachments: [],
  created_at: "2026-05-29T18:30:00Z",
};

const REPLY = {
  id: 90002,
  source_id: "wamid.REPLY",
  content: "Sí, claro que sí",
  message_type: "outgoing",
  content_type: "text",
  content_attributes: {
    in_reply_to: "wamid.ORIGINAL",
    // Snapshot resuelto por el backend (el frontend lo usa aunque el original no esté cargado).
    quoted: {
      id: 90001,
      message_type: "incoming",
      content_type: "text",
      content: "¿Tienen stock del producto?",
      sender_name: "Juan Pérez",
    },
  },
  additional_attributes: null,
  status: "read",
  sender: null,
  attachments: [],
  created_at: "2026-05-29T18:31:00Z",
};

// Coincide con .../conversations/{id}/messages (y ?query), pero NO con /messages/search.
const MESSAGES_RE = /\/api\/messaging\/conversations\/\d+\/messages(\?.*)?$/;

test.describe("Reply citando mensajes (quoted reply) @messaging @critical", () => {
  test.beforeEach(async ({ page, conversationsPage }) => {
    await page.route(MESSAGES_RE, async (route) => {
      if (route.request().method() === "POST") {
        // Eco de un mensaje creado: el envío nunca llega al backend real / Meta.
        await route.fulfill({
          json: { success: true, message: "ok", data: { ...REPLY, id: 90003, content: "Respuesta enviada" } },
        });
        return;
      }
      await route.fulfill({
        json: { success: true, data: [ORIGINAL, REPLY], meta: { has_more: false } },
      });
    });

    await conversationsPage.goto();
    await conversationsPage.conversationItems.first().click();
    // Espera a que los mensajes mockeados rendericen.
    await expect(page.locator('[data-msg-id="90002"]')).toBeVisible({ timeout: 10_000 });
  });

  test("renderiza el mensaje citado con su contenido real (no el fallback)", async ({ page }) => {
    const quote = page.locator('[data-msg-id="90002"]').getByTestId("bubble-quote");

    await expect(quote).toBeVisible();
    await expect(quote).toContainText("¿Tienen stock del producto?");
    await expect(quote).toContainText("Juan Pérez");
    await expect(quote).not.toContainText("Mensaje original");
  });

  test("responder abre el preview de cita en el composer y se puede cancelar", async ({ page }) => {
    const original = page.locator('[data-msg-id="90001"]');

    await original.hover();
    await original.getByLabel("Responder").click();

    const preview = page.getByTestId("composer-reply-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("¿Tienen stock del producto?");

    await preview.getByLabel("Cancelar respuesta").click();
    await expect(preview).toBeHidden();
  });

  test("click en la cita salta al mensaje original y lo resalta", async ({ page }) => {
    await page.locator('[data-msg-id="90002"]').getByTestId("bubble-quote").click();

    // El wrapper del mensaje original recibe el highlight temporal (bg-volt).
    await expect(
      page.locator('[data-msg-id="90001"] [class*="bg-volt"]').first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
