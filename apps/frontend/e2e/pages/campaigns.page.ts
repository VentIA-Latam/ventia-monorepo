import { type Page, type Locator, expect } from "@playwright/test";

export type StatusFilter =
  | "all"
  | "draft"
  | "scheduled"
  | "in_progress"
  | "sent";

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Page Object Model para el módulo de campañas.
 * Cubre la lista (filtros, CTA crear, cards) y el wizard (stepper + steps 1/3).
 *
 * Estrategia de locators: priorizar `data-testid` (matchea el patrón de
 * `channels.page.ts`). Roles/texto solo donde el testid no aplica.
 */
export class CampaignsPage {
  readonly page: Page;
  // Lista
  readonly newButton: Locator;
  readonly filterPills: Locator;
  readonly emptyState: Locator;
  readonly emptyStateCreateButton: Locator;
  // Wizard
  readonly wizard: Locator;
  readonly stepper: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  // Step 1
  readonly step1TitleInput: Locator;
  // Step 3
  readonly audienceModeCsv: Locator;
  readonly audienceModeLabels: Locator;
  readonly labelsPicker: Locator;
  readonly labelsPreviewButton: Locator;
  readonly labelsAppliedCount: Locator;
  // Delete dialog
  readonly deleteDialog: Locator;
  readonly deleteConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newButton = page.getByTestId("campaigns-new-button");
    this.filterPills = page.getByTestId("campaigns-filter-pills");
    this.emptyState = page.getByTestId("campaigns-empty-state");
    this.emptyStateCreateButton = page.getByTestId(
      "campaigns-empty-state-create-button"
    );
    this.wizard = page.getByTestId("campaign-wizard");
    this.stepper = page.getByTestId("wizard-stepper");
    this.nextButton = page.getByTestId("wizard-next-button");
    this.backButton = page.getByTestId("wizard-back-button");
    this.step1TitleInput = page.getByTestId("step1-title-input");
    this.audienceModeCsv = page.getByTestId("audience-mode-csv");
    this.audienceModeLabels = page.getByTestId("audience-mode-labels");
    this.labelsPicker = page.getByTestId("labels-picker");
    this.labelsPreviewButton = page.getByTestId("labels-preview-button");
    this.labelsAppliedCount = page.getByTestId("labels-applied-count");
    this.deleteDialog = page.getByTestId("delete-campaign-dialog");
    this.deleteConfirmButton = page.getByTestId("delete-campaign-confirm");
  }

  async goto() {
    await this.page.goto("/dashboard/campaigns");
    // En dev de Next.js 16 con RSC, durante hidratación el DOM puede contener
    // brevemente nodos duplicados (RSC HTML + hidratación client) hasta que
    // React reconcilia. `networkidle` espera a que la RSC payload termine de
    // cargar — sin esto, getByTestId puede ver 2 elementos.
    await this.page.waitForLoadState("networkidle");
    await Promise.race([
      this.newButton.waitFor({ state: "visible" }),
      this.emptyState.waitFor({ state: "visible" }),
    ]);
  }

  /**
   * Navega directo al wizard de una campaña en el step pedido, esperando a que
   * hidratación termine (mismo motivo que `goto()` — sin networkidle hay
   * duplicados transientes que rompen strict locators).
   */
  async gotoWizard(campaignId: number, step: WizardStep) {
    await this.page.goto(
      `/dashboard/campaigns/${campaignId}/edit?step=${step}`
    );
    await this.page.waitForLoadState("networkidle");
    await this.wizard.waitFor({ state: "visible" });
    await this.expectAtStep(step);
  }

  filterPill(kind: StatusFilter): Locator {
    return this.page.getByTestId(`filter-pill-${kind}`);
  }

  card(campaignId: number): Locator {
    return this.page.getByTestId(`campaign-card-${campaignId}`);
  }

  /** Card por título (útil cuando no conocés el id, ej. recién creada via UI). */
  cardByTitle(title: string): Locator {
    return this.page
      .locator('[data-testid^="campaign-card-"]')
      .filter({ hasText: title });
  }

  deleteButton(campaignId: number): Locator {
    return this.page.getByTestId(`campaign-card-delete-${campaignId}`);
  }

  labelCheckbox(labelId: number): Locator {
    return this.page.getByTestId(`label-checkbox-${labelId}`);
  }

  labelRow(labelId: number): Locator {
    return this.page.getByTestId(`label-row-${labelId}`);
  }

  stepButton(step: WizardStep): Locator {
    return this.page.getByTestId(`wizard-step-${step}`);
  }

  /** Crea una campaña desde la lista clickeando "+Nueva campaña". */
  async clickNewCampaign() {
    await this.newButton.click();
    // Tras crear, redirige al wizard step 1.
    await this.page.waitForURL(/\/campaigns\/\d+\/edit\?step=1/, {
      timeout: 15_000,
    });
  }

  async expectAtStep(step: WizardStep) {
    await expect(this.wizard).toHaveAttribute("data-step", String(step));
  }

  async expectActiveFilter(kind: StatusFilter) {
    await expect(this.filterPill(kind)).toHaveAttribute("data-active", "true");
  }

  /**
   * Extrae el campaignId del URL del wizard (`/campaigns/{id}/edit?step=N`).
   * Útil para tests que crearon una campaña via UI y necesitan el id para cleanup.
   */
  campaignIdFromUrl(): number {
    const m = this.page.url().match(/\/campaigns\/(\d+)\/edit/);
    if (!m) throw new Error("No campaignId found in URL: " + this.page.url());
    return Number(m[1]);
  }
}
