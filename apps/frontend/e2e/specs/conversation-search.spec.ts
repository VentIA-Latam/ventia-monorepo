import { test, expect } from "../fixtures/pages.fixture";

test.describe("Búsqueda en lista de conversaciones @search @smoke", () => {
  test.beforeEach(async ({ conversationsPage }) => {
    await conversationsPage.goto();
  });

  test("buscar por nombre de contacto muestra resultados", async ({
    conversationsPage,
  }) => {
    await conversationsPage.search("Emilio");
    await conversationsPage.expectConversationVisible("Emilio Villanueva");
  });

  test("buscar por contenido de mensaje muestra sección Mensajes", async ({
    conversationsPage,
  }) => {
    await conversationsPage.search("provincias");
    await conversationsPage.expectMessageSectionVisible();
  });

  test("limpiar búsqueda restaura la lista completa", async ({
    conversationsPage,
    page,
  }) => {
    await conversationsPage.search("Emilio");
    await conversationsPage.expectConversationVisible("Emilio");
    await conversationsPage.clearSearch();
    await page.waitForTimeout(1000);

    const items = await conversationsPage.conversationItems.all();
    expect(items.length).toBeGreaterThan(3);
  });
});
