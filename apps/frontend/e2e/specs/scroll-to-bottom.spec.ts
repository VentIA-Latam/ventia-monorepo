import { test, expect } from "../fixtures/pages.fixture";

test.describe("Botón scroll-to-bottom @ui", () => {
  test.beforeEach(async ({ conversationsPage, messageViewPage }) => {
    await conversationsPage.goto();
    await conversationsPage.selectConversation("Diego Mamani");
    await expect(messageViewPage.messagesContainer).toBeVisible();
    await messageViewPage.page.waitForTimeout(500);
  });

  test("botón aparece al hacer scroll hacia arriba", async ({
    messageViewPage,
  }) => {
    await messageViewPage.expectScrollDownHidden();
    await messageViewPage.scrollUp(1000);
    await messageViewPage.expectScrollDownVisible();
  });

  test("click en botón lleva al fondo", async ({ messageViewPage, page }) => {
    await messageViewPage.scrollUp(1000);
    await messageViewPage.expectScrollDownVisible();

    await messageViewPage.clickScrollDown();
    await page.waitForTimeout(500);
    await messageViewPage.expectScrollDownHidden();
  });
});
