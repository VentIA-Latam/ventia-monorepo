import { test, expect } from "../fixtures/pages.fixture";

test.describe("Saltar a mensaje desde búsqueda @search @critical", () => {
  test("desde lista de conversaciones salta al mensaje", async ({
    conversationsPage,
    messageViewPage,
  }) => {
    await conversationsPage.goto();
    await conversationsPage.search("provincias");
    await conversationsPage.expectMessageSectionVisible();

    await conversationsPage.selectMessageResult("provincias");

    await expect(messageViewPage.messagesContainer).toBeVisible({ timeout: 10_000 });
    await messageViewPage.expectMessageHighlighted();
  });

  test("desde búsqueda in-chat salta al mensaje", async ({
    conversationsPage,
    messageViewPage,
    messageSearchPage,
  }) => {
    await conversationsPage.goto();
    await conversationsPage.selectConversation("Diego Mamani");
    await expect(messageViewPage.messagesContainer).toBeVisible();

    await messageViewPage.openSearch();
    await messageSearchPage.search("pedido");
    await messageSearchPage.expectResultsVisible();

    await messageSearchPage.clickResult(0);
    await messageViewPage.expectMessageHighlighted();
  });
});
