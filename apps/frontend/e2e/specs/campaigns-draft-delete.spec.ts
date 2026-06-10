import { test, expect } from "../fixtures/pages.fixture";
import {
  createCampaign,
  deleteCampaign,
  fetchInboxes,
  getAccessToken,
  makeTestTitle,
} from "../fixtures/campaigns-api";

/**
 * Verifica el botón "Borrar borrador" del card y el AlertDialog que abre.
 * Cleanup: si el test pasa, el draft ya quedó borrado por la UI; si falla,
 * limpiamos via API por las dudas.
 */
test.describe("Campaigns — borrar borrador desde la lista @critical @campaigns", () => {
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

  test("trash icon → confirmar borra el card de la lista", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("delete"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();
    await campaignsPage.filterPill("draft").click();

    await expect(campaignsPage.card(draft.id)).toBeVisible();

    await campaignsPage.deleteButton(draft.id).click();
    await expect(campaignsPage.deleteDialog).toBeVisible();

    await campaignsPage.deleteConfirmButton.click();

    // Tras borrar, el card desaparece de la lista (router.refresh actualiza RSC).
    await expect(campaignsPage.card(draft.id)).toBeHidden({ timeout: 10_000 });

    // El test ya borró el draft via UI — marcá null para que afterEach skipee.
    createdId = null;
  });

  test("dialog cancelado deja la campaña intacta", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("delete-cancel"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();
    await campaignsPage.filterPill("draft").click();
    await campaignsPage.deleteButton(draft.id).click();

    await expect(campaignsPage.deleteDialog).toBeVisible();
    await page.getByRole("button", { name: /cancelar/i }).click();

    // Card sigue ahí.
    await expect(campaignsPage.card(draft.id)).toBeVisible();
  });
});
