import { test, expect } from "../fixtures/pages.fixture";

/**
 * Runs against the real backend. Verifies that the inbox meta line in each
 * conversation item has the correct data-channel-kind attribute. Doesn't
 * assume specific conversation IDs — just that at least one of each kind exists.
 */
test.describe("Badges de canal en lista de conversaciones @smoke @channels", () => {
  test.beforeEach(async ({ conversationsPage }) => {
    await conversationsPage.goto();
  });

  test("al menos una conversación tiene badge de WhatsApp", async ({ page }) => {
    const waMetas = page.locator(
      '[data-testid="conversation-channel-meta"][data-channel-kind="whatsapp"]'
    );
    test.skip(
      (await waMetas.count()) === 0,
      "no WhatsApp conversations in dev backend"
    );
    await expect(waMetas.first()).toBeVisible();
  });

  test("al menos una conversación tiene badge de Instagram", async ({ page }) => {
    const igMetas = page.locator(
      '[data-testid="conversation-channel-meta"][data-channel-kind="instagram"]'
    );
    test.skip(
      (await igMetas.count()) === 0,
      "no Instagram conversations in dev backend"
    );
    await expect(igMetas.first()).toBeVisible();
  });

  test("los badges aparecen junto a un nombre de bandeja no vacío", async ({
    page,
  }) => {
    const metas = page.getByTestId("conversation-channel-meta");
    test.skip((await metas.count()) === 0, "no conversations with inbox meta");

    const sample = metas.first();
    await expect(sample).toBeVisible();
    const text = (await sample.textContent())?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    // El label no debe terminar con el nombre del canal (sufijo eliminado).
    expect(text).not.toMatch(/\s+(whatsapp|instagram)\s*$/i);
  });
});
