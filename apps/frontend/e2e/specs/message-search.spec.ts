import { test, expect } from "../fixtures/pages.fixture";

test.describe("Búsqueda dentro del chat @search", () => {
  test.beforeEach(async ({ conversationsPage, messageViewPage }) => {
    await conversationsPage.goto();
    await conversationsPage.selectConversation("Diego Mamani");
    await expect(messageViewPage.messagesContainer).toBeVisible();
  });

  test("abrir panel de búsqueda con lupa", async ({
    messageViewPage,
    messageSearchPage,
  }) => {
    await messageViewPage.openSearch();
    await messageSearchPage.expectPanelVisible();
    await expect(messageSearchPage.emptyPrompt).toBeVisible();
  });

  test("buscar mensajes muestra resultados con snippets", async ({
    messageViewPage,
    messageSearchPage,
  }) => {
    await messageViewPage.openSearch();
    await messageSearchPage.search("pedido");
    await messageSearchPage.expectResultsVisible();
  });

  test("búsqueda sin resultados muestra mensaje vacío", async ({
    messageViewPage,
    messageSearchPage,
  }) => {
    await messageViewPage.openSearch();
    await messageSearchPage.search("zzzznoexisteesto");
    await messageSearchPage.expectNoResults();
  });

  test("cerrar panel con botón X", async ({
    messageViewPage,
    messageSearchPage,
  }) => {
    await messageViewPage.openSearch();
    await messageSearchPage.close();
    await messageSearchPage.expectPanelHidden();
  });

  test("Escape cierra el panel", async ({
    messageViewPage,
    messageSearchPage,
  }) => {
    await messageViewPage.openSearch();
    await messageSearchPage.searchInput.press("Escape");
    await messageSearchPage.expectPanelHidden();
  });
});
