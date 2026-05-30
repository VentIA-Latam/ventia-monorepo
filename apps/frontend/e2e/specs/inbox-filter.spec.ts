import { test, expect } from "../fixtures/pages.fixture";

/**
 * Runs against the real backend. The dropdown only appears when the tenant
 * has more than one inbox, which is true in dev (WA + IG).
 */
test.describe("Filtro de bandejas en /conversations @smoke @channels", () => {
  test.beforeEach(async ({ conversationsPage }) => {
    await conversationsPage.goto();
    try {
      await conversationsPage.inboxFilterTrigger.waitFor({
        state: "attached",
        timeout: 5_000,
      });
    } catch {
      test.skip(true, "requires more than one inbox seeded");
    }
  });

  test("trigger abre el dropdown con grupos por canal", async ({
    conversationsPage,
  }) => {
    await conversationsPage.openInboxFilter();

    // We expect at least WA + IG groups in dev. Other might or might not exist.
    await conversationsPage.expectInboxGroupVisible("whatsapp");
    await conversationsPage.expectInboxGroupVisible("instagram");
  });

  test("master toggle 'Todas las bandejas' está activo por defecto", async ({
    conversationsPage,
  }) => {
    await conversationsPage.openInboxFilter();

    await expect(conversationsPage.inboxFilterAllToggle).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  test("seleccionar solo una bandeja deja al master en estado mixto", async ({
    conversationsPage,
    page,
  }) => {
    await conversationsPage.openInboxFilter();

    const options = page.locator('[data-testid="inbox-filter-option"]');
    const total = await options.count();
    expect(total).toBeGreaterThanOrEqual(2);

    // Desmarcar todas menos la primera → estado parcial.
    for (let i = 1; i < total; i++) {
      await options.nth(i).click();
    }

    await expect(conversationsPage.inboxFilterAllToggle).toHaveAttribute(
      "aria-checked",
      "mixed"
    );
  });

  test("no permite quedar sin ninguna bandeja seleccionada", async ({
    conversationsPage,
    page,
  }) => {
    await conversationsPage.openInboxFilter();

    const options = page.locator('[data-testid="inbox-filter-option"]');
    const total = await options.count();

    // Desmarcar todas menos la primera.
    for (let i = 1; i < total; i++) {
      await options.nth(i).click();
    }
    // Intentar desmarcar la última: la UI debe ignorar el click.
    await options.nth(0).click();
    await expect(options.nth(0)).toHaveAttribute("aria-checked", "true");
  });

  test("'Restablecer' vuelve a 'Todas las bandejas' activo", async ({
    conversationsPage,
    page,
  }) => {
    await conversationsPage.openInboxFilter();

    const firstOption = page.locator('[data-testid="inbox-filter-option"]').first();
    await firstOption.click();
    await expect(conversationsPage.inboxFilterAllToggle).toHaveAttribute(
      "aria-checked",
      "mixed"
    );

    await page.getByRole("button", { name: /restablecer/i }).click();
    await expect(conversationsPage.inboxFilterAllToggle).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
