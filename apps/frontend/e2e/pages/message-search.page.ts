import { type Page, type Locator, expect } from "@playwright/test";

export class MessageSearchPage {
  readonly page: Page;
  readonly panel: Locator;
  readonly searchInput: Locator;
  readonly closeButton: Locator;
  readonly clearButton: Locator;
  readonly loadingIndicator: Locator;
  readonly noResultsMessage: Locator;
  readonly emptyPrompt: Locator;
  readonly results: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByRole("dialog", { name: "Buscar mensajes" });
    this.searchInput = this.panel.getByPlaceholder("Buscar...");
    this.closeButton = page.getByLabel("Cerrar búsqueda");
    this.clearButton = this.panel.getByLabel("Limpiar búsqueda");
    this.loadingIndicator = this.panel.getByText("Buscando...");
    this.emptyPrompt = this.panel.getByText(
      "Escribe para buscar en esta conversación"
    );
    this.noResultsMessage = this.panel.getByText(/Sin resultados para/);
    this.results = this.panel.locator("button[class*='text-left']");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.loadingIndicator
      .waitFor({ state: "visible", timeout: 2_000 })
      .catch(() => {});
    await this.loadingIndicator.waitFor({
      state: "hidden",
      timeout: 10_000,
    });
  }

  async clickResult(index: number = 0) {
    await this.results.nth(index).click();
  }

  async close() {
    await this.closeButton.click();
  }

  async expectResultsVisible() {
    await expect(this.results.first()).toBeVisible();
  }

  async expectNoResults() {
    await expect(this.noResultsMessage).toBeVisible();
  }

  async expectPanelVisible() {
    await expect(this.panel).toBeVisible();
  }

  async expectPanelHidden() {
    await expect(this.panel).toBeHidden();
  }
}
