import { test, expect } from "../fixtures/pages.fixture";

test.describe("Búsqueda en mobile @mobile", () => {
  test("panel ocupa pantalla completa", async ({
    conversationsPage,
    messageViewPage,
    messageSearchPage,
    page,
  }) => {
    const viewport = page.viewportSize()!;
    expect(viewport.width).toBeLessThan(768);

    await conversationsPage.goto();
    const items = await conversationsPage.conversationItems.all();
    await items[0].click();
    await expect(messageViewPage.messagesContainer).toBeVisible();

    await messageViewPage.openSearch();
    await messageSearchPage.expectPanelVisible();

    const panelBox = await messageSearchPage.panel.boundingBox();
    expect(panelBox!.width).toBeCloseTo(viewport.width, -1);
  });

  test("click en resultado cierra panel automáticamente", async ({
    conversationsPage,
    messageViewPage,
    messageSearchPage,
  }) => {
    await conversationsPage.goto();
    const items = await conversationsPage.conversationItems.all();
    await items[0].click();
    await expect(messageViewPage.messagesContainer).toBeVisible();

    await messageViewPage.openSearch();
    await messageSearchPage.search("pedido");
    await messageSearchPage.expectResultsVisible();

    await messageSearchPage.clickResult(0);
    await messageSearchPage.expectPanelHidden();
  });

  test("back vuelve a la lista", async ({
    conversationsPage,
    messageViewPage,
  }) => {
    await conversationsPage.goto();
    const items = await conversationsPage.conversationItems.all();
    await items[0].click();
    await expect(messageViewPage.messagesContainer).toBeVisible();

    await messageViewPage.goBack();
    await expect(conversationsPage.searchInput).toBeVisible();
  });
});
