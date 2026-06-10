import { test, expect } from "../fixtures/pages.fixture";
import {
  createCampaign,
  deleteCampaign,
  fetchInboxes,
  getAccessToken,
  makeTestTitle,
} from "../fixtures/campaigns-api";

/**
 * Regresión: el card de campaña debe ser clickeable en cualquier punto y
 * navegar al wizard cuando es draft. Bug anterior: con Link overlay absolute
 * detrás del content, los clicks sobre el contenido no disparaban navegación.
 */
test.describe("Campaigns — card navigation @critical @campaigns", () => {
  // Serial: cada test crea/borra un draft via API; en parallel, el dev server
  // de Next.js 16 muestra jitter de hidratación (RSC payload + cards animados)
  // que rompe locators strict. Cost: 3 tests * ~2s = ~6s en vez de ~2s.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
  });

  let createdId: number | null = null;

  test.afterEach(async ({ page }) => {
    if (createdId === null) return;
    const token = await getAccessToken(page);
    await deleteCampaign(page.request, token, createdId);
    createdId = null;
  });

  test("click en card de draft navega a /edit?step=1", async ({
    page,
    campaignsPage,
  }) => {
    // Setup: crear draft via API para tener algo en la lista de forma determinista.
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(
      inboxes.length === 0,
      "Sin inbox de WhatsApp configurado en el tenant"
    );
    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("card-nav"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();
    // Asegurate que la pill de Borradores esté activa para que el card aparezca.
    await campaignsPage.filterPill("draft").click();

    const card = campaignsPage.card(draft.id);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-status", "draft");

    // Click en el card (cualquier punto vía el title) → navega al wizard.
    await card.getByText(draft.title).click();
    await page.waitForURL(
      new RegExp(`/dashboard/campaigns/${draft.id}/edit\\?step=1`)
    );
    await expect(campaignsPage.wizard).toBeVisible();
    await campaignsPage.expectAtStep(1);
  });

  test("click en 'Continuar →' del card también navega", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");
    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("draft-continue"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();
    await campaignsPage.filterPill("draft").click();

    const card = campaignsPage.card(draft.id);
    await expect(card).toBeVisible();

    // "Continuar →" — locator exacto (anclado a "Continuar →" como string)
    // para no matchear el aria-label del Link si el título contiene la palabra.
    await card.getByText("Continuar →", { exact: true }).click();
    await page.waitForURL(
      new RegExp(`/dashboard/campaigns/${draft.id}/edit\\?step=1`)
    );
    await campaignsPage.expectAtStep(1);
  });

  test("click en icono de borrar NO navega al wizard", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");
    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("no-nav-on-trash"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();
    await campaignsPage.filterPill("draft").click();

    const urlBefore = page.url();
    await campaignsPage.deleteButton(draft.id).click();

    // Debe abrir el dialog, no navegar.
    await expect(campaignsPage.deleteDialog).toBeVisible();
    expect(page.url()).toBe(urlBefore);

    // Cancelo el dialog para que el cleanup pueda borrar via API limpio.
    await page.getByRole("button", { name: /cancelar/i }).click();
  });
});
