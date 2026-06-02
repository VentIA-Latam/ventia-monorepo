import { test, expect } from "../fixtures/pages.fixture";

test.describe("Canales — dropdown 'Conectar canal' @critical @channels", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
  });

  test.beforeEach(async ({ channelsPage }) => {
    await channelsPage.goto();
    // Skip if we landed on the empty state — the "Conectar canal" button
    // only renders when there is at least one connected channel.
    if (await channelsPage.emptyState.isVisible().catch(() => false)) {
      test.skip();
    }
  });

  test("abre el dropdown con opciones WhatsApp e Instagram", async ({
    page,
    channelsPage,
  }) => {
    await channelsPage.openConnectDropdown();

    const wa = page.getByTestId("connect-dropdown-whatsapp");
    const ig = page.getByTestId("connect-dropdown-instagram");

    await expect(wa).toBeVisible();
    await expect(wa).toContainText("WhatsApp");
    await expect(wa).toContainText("Business Cloud API");

    await expect(ig).toBeVisible();
    await expect(ig).toContainText("Instagram");
    await expect(ig).toContainText("Direct Messages");
  });

  test("click en Instagram inicia navegación a /dashboard/instagram-connect/consent", async ({
    page,
    channelsPage,
  }) => {
    // Intercept the consent route at the browser level so we don't actually
    // hit Meta's OAuth screen.
    await page.route("**/dashboard/instagram-connect/consent", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>OK</body></html>",
      })
    );

    await channelsPage.openConnectDropdown();
    await page.getByTestId("connect-dropdown-instagram").click();

    await page.waitForURL("**/dashboard/instagram-connect/consent");
    expect(page.url()).toContain("/dashboard/instagram-connect/consent");
  });
});
