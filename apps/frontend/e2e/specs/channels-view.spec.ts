import { test, expect } from "../fixtures/pages.fixture";

/**
 * Runs against the real dev backend. Asserts behavior that holds for
 * "at least one of each channel" — does not assume specific channel IDs.
 */
test.describe("Canales — vista con canales conectados @smoke @channels", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
  });

  test("header, conteo y al menos un card por canal son visibles", async ({
    page,
    channelsPage,
  }) => {
    await channelsPage.goto();

    await expect(channelsPage.heading).toBeVisible();
    await expect(channelsPage.connectButton).toBeVisible();

    // At least one of each kind should render in the grid.
    const waCards = page.locator('[data-testid^="channel-card-wa-"]');
    const igCards = page.locator('[data-testid^="channel-card-ig-"]');

    await expect(waCards.first()).toBeVisible();
    await expect(igCards.first()).toBeVisible();
  });

  test("header refleja el conteo de canales conectados", async ({
    page,
    channelsPage,
  }) => {
    await channelsPage.goto();

    const waCount = await page.locator('[data-testid^="channel-card-wa-"]').count();
    const igCount = await page.locator('[data-testid^="channel-card-ig-"]').count();
    const total = waCount + igCount;

    const expected =
      total === 1 ? "1 canal conectado" : `${total} canales conectados`;
    await expect(page.getByText(expected, { exact: false })).toBeVisible();
  });
});
