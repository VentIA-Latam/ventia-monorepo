import { test, expect } from "../fixtures/pages.fixture";

/**
 * Runs against the real dev backend with both WA + IG channels seeded.
 * Filter pills only appear when there are channels of both kinds.
 */
test.describe("Canales — filter pills @smoke @channels", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
  });

  test.beforeEach(async ({ page, channelsPage }) => {
    await channelsPage.goto();
    const hasBoth =
      (await page.locator('[data-testid^="channel-card-wa-"]').count()) > 0 &&
      (await page.locator('[data-testid^="channel-card-ig-"]').count()) > 0;
    test.skip(!hasBoth, "requires both WA and IG channels seeded");
  });

  test("'Todos' está activo por defecto", async ({ channelsPage }) => {
    await channelsPage.expectActiveFilter("all");
    await expect(channelsPage.pill("whatsapp")).toBeVisible();
    await expect(channelsPage.pill("instagram")).toBeVisible();
  });

  test("filtro WhatsApp oculta cards de Instagram", async ({ page, channelsPage }) => {
    await channelsPage.selectFilter("whatsapp");
    await channelsPage.expectActiveFilter("whatsapp");

    await expect(page.locator('[data-testid^="channel-card-wa-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="channel-card-ig-"]').first()).toBeHidden();
  });

  test("filtro Instagram oculta cards de WhatsApp", async ({ page, channelsPage }) => {
    await channelsPage.selectFilter("instagram");
    await channelsPage.expectActiveFilter("instagram");

    await expect(page.locator('[data-testid^="channel-card-ig-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="channel-card-wa-"]').first()).toBeHidden();
  });

  test("volver a 'Todos' restaura ambos canales", async ({ page, channelsPage }) => {
    await channelsPage.selectFilter("whatsapp");
    await channelsPage.selectFilter("all");

    await channelsPage.expectActiveFilter("all");
    await expect(page.locator('[data-testid^="channel-card-wa-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="channel-card-ig-"]').first()).toBeVisible();
  });
});
