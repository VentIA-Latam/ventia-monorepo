import { test, expect } from "../fixtures/pages.fixture";
import {
  createCampaign,
  deleteCampaign,
  fetchInboxes,
  getAccessToken,
  makeTestTitle,
} from "../fixtures/campaigns-api";

/**
 * Filter pills: filtran in-memory (no llamada al backend), badges cuentan,
 * la pill activa es la única con `data-active="true"`.
 */
test.describe("Campaigns — filter pills @campaigns", () => {
  // Serial: ver comentario en `campaigns-card-navigation.spec.ts`.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
  });

  let createdId: number | null = null;

  // Todas las assertions sobre filter pills requieren que la lista esté
  // renderizada (no EmptyState). Seedea un draft antes de cada test.
  async function seedDraft(page: import("@playwright/test").Page, suffix: string) {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    if (inboxes.length === 0) return null;
    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle(suffix),
      inbox_id: inboxes[0].id,
    });
    return draft.id;
  }

  test.afterEach(async ({ page }) => {
    if (createdId === null) return;
    const token = await getAccessToken(page);
    await deleteCampaign(page.request, token, createdId);
    createdId = null;
  });

  test("'Todas' está activa por default", async ({ page, campaignsPage }) => {
    createdId = await seedDraft(page, "default-active");
    test.skip(createdId === null, "Sin inbox de WhatsApp");
    await campaignsPage.goto();
    await campaignsPage.expectActiveFilter("all");
  });

  test("click en pill cambia el active y filtra el listado", async ({
    page,
    campaignsPage,
  }) => {
    // Crear un draft garantiza que la pill 'Borradores' tenga ≥1 match.
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("filter-draft"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();

    // Click 'Borradores' → solo esa pill queda activa.
    await campaignsPage.filterPill("draft").click();
    await campaignsPage.expectActiveFilter("draft");
    await expect(campaignsPage.filterPill("all")).toHaveAttribute(
      "data-active",
      "false"
    );

    // El draft creado aparece en el listado filtrado.
    await expect(campaignsPage.card(draft.id)).toBeVisible();

    // Click 'Enviadas' → el draft desaparece del view (filter in-memory).
    await campaignsPage.filterPill("sent").click();
    await campaignsPage.expectActiveFilter("sent");
    await expect(campaignsPage.card(draft.id)).toBeHidden();
  });

  test("badge de 'Borradores' refleja el conteo real", async ({
    page,
    campaignsPage,
  }) => {
    const token = await getAccessToken(page);
    const inboxes = await fetchInboxes(page.request, token);
    test.skip(inboxes.length === 0, "Sin inbox de WhatsApp");

    const draft = await createCampaign(page.request, token, {
      title: makeTestTitle("filter-badge"),
      inbox_id: inboxes[0].id,
    });
    createdId = draft.id;

    await campaignsPage.goto();

    // El badge dentro de la pill 'Borradores' incluye el conteo. Buscamos un
    // número ≥ 1 (puede haber otros drafts pre-existentes en el tenant).
    const draftPillText = await campaignsPage.filterPill("draft").innerText();
    const match = draftPillText.match(/(\d+)/);
    expect(match).not.toBeNull();
    const count = Number(match![1]);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
