import { test, expect } from "../fixtures/pages.fixture";
import {
  deleteCampaign,
  fetchInboxes,
  getAccessToken,
} from "../fixtures/campaigns-api";

/**
 * Regresión: "+Nueva campaña" crea un draft via fetch del client (era Server
 * Action) y redirige al wizard step 1. El fix anterior eliminó el bug de
 * prefetch que disparaba createCampaign en background generando drafts
 * huérfanos.
 */
test.describe("Campaigns — '+Nueva campaña' @critical @campaigns", () => {
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

  test("click en CTA crea draft y redirige al wizard step 1", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(
      inboxes.length === 0,
      "Sin inbox de WhatsApp configurado en el tenant"
    );

    await campaignsPage.goto();
    await expect(campaignsPage.newButton).toBeEnabled();
    await campaignsPage.clickNewCampaign();

    // Extraé el id del URL para asegurar cleanup.
    createdId = campaignsPage.campaignIdFromUrl();
    expect(createdId).toBeGreaterThan(0);

    await campaignsPage.expectAtStep(1);
    // El title input se rellena con el default "Nueva campaña sin nombre".
    await expect(campaignsPage.step1TitleInput).toHaveValue(/Nueva campaña/);
  });

  test("CTA muestra estado loading durante la creación", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");

    await campaignsPage.goto();

    // Click + verificá que el button reporta loading antes de redirect.
    // Race: o cambia label a "Creando..." o ya redirigió. Cualquiera es OK.
    await campaignsPage.newButton.click();
    await page.waitForURL(/\/campaigns\/\d+\/edit/, { timeout: 15_000 });
    createdId = campaignsPage.campaignIdFromUrl();
  });
});
