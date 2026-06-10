import { test, expect } from "../fixtures/pages.fixture";
import {
  createCampaign,
  deleteCampaign,
  fetchInboxes,
  fetchLabels,
  getAccessToken,
  makeTestTitle,
} from "../fixtures/campaigns-api";

/**
 * Regresión: en step 3 (Audiencia), seleccionar una etiqueta y clickear
 * "Siguiente →" debe auto-aplicar el snapshot y avanzar. Bug anterior:
 * `selectedIds` vivía como state local del `LabelsPicker`, el parent no se
 * enteraba, y "Siguiente →" quedaba disabled aunque hubiera selección.
 */
test.describe("Campaigns — step 3 labels flow @critical @campaigns", () => {
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

  test("seleccionar label + Siguiente avanza sin clickear 'Previsualizar conteo'", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    const labels = await fetchLabels(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");
    test.skip(labels.length === 0, "Sin labels configurados en el tenant");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("labels-flow"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    // Navegar directo al step 3 (el wizard acepta cualquier step via URL).
    await campaignsPage.gotoWizard(draft.id, 3);

    // Default mode al entrar sin audience_type es "labels". Lo aseguramos.
    await campaignsPage.audienceModeLabels.click();
    await expect(campaignsPage.audienceModeLabels).toHaveAttribute(
      "data-active",
      "true"
    );

    // Marcar la primera label disponible (la lista de labels viene del backend).
    const firstLabel = labels[0];
    await campaignsPage.labelCheckbox(firstLabel.id).click();
    await expect(campaignsPage.labelCheckbox(firstLabel.id)).toBeChecked();

    // "Siguiente →" debe estar habilitado por la selección — NO requiere
    // pasar por "Previsualizar conteo" como paso intermedio.
    await expect(campaignsPage.nextButton).toBeEnabled();
    await campaignsPage.nextButton.click();

    // Si la label tiene al menos 1 contacto, avanzamos al step 4. Si tiene 0
    // contactos, el backend devuelve recipients_count: 0 y muestra toast
    // "Sin destinatarios" — en ese caso skipeamos como inconclusivo.
    // Locator del toast: scoping a role="status" + `.first()` por si hay toast
    // queue con varios items (caso real en runs paralelos).
    const emptyToast = page
      .locator('[role="status"]')
      .filter({ hasText: /sin destinatarios/i })
      .first();
    await Promise.race([
      page.waitForURL(/\?step=4/, { timeout: 10_000 }),
      emptyToast.waitFor({ timeout: 10_000 }),
    ]);

    if (page.url().includes("step=4")) {
      await campaignsPage.expectAtStep(4);
    } else {
      test.skip(
        true,
        `Label "${firstLabel.title}" no tiene contactos — flujo no verificable`
      );
    }
  });

  test("'Previsualizar conteo' muestra count sin avanzar", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    const labels = await fetchLabels(page.request, token);
    test.skip(inboxes.length === 0 || labels.length === 0, "Sin inbox o labels");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("labels-preview"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.gotoWizard(draft.id, 3);
    await campaignsPage.audienceModeLabels.click();
    await campaignsPage.labelCheckbox(labels[0].id).click();

    // Preview button enabled cuando hay selección.
    await expect(campaignsPage.labelsPreviewButton).toBeEnabled();
    await campaignsPage.labelsPreviewButton.click();

    // Después de aplicar, muestra el conteo y NO avanza de step.
    await expect(campaignsPage.labelsAppliedCount).toBeVisible();
    await campaignsPage.expectAtStep(3);
  });

  test("Siguiente disabled cuando no hay labels seleccionados", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("labels-empty"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.gotoWizard(draft.id, 3);
    await campaignsPage.audienceModeLabels.click();

    // Sin selección, "Siguiente →" sigue disabled.
    await expect(campaignsPage.nextButton).toBeDisabled();
  });
});
