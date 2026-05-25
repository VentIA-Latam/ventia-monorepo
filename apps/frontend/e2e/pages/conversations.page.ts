import { type Page, type Locator, expect } from "@playwright/test";

export class ConversationsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly clearSearchButton: Locator;
  readonly conversationItems: Locator;
  readonly messageResultsHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder("Buscar o iniciar chat");
    this.clearSearchButton = page.getByLabel("Limpiar búsqueda");
    this.conversationItems = page.locator("[style*='content-visibility']");
    this.messageResultsHeader = page.locator("div.uppercase").filter({ hasText: "Mensajes" });
  }

  async goto() {
    await this.page.goto("/dashboard/conversations");
    await expect(this.searchInput).toBeVisible({ timeout: 15_000 });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.clearSearchButton.click();
    await this.page.waitForTimeout(500);
  }

  async selectConversation(contactName: string) {
    await this.conversationItems
      .filter({ hasText: contactName })
      .first()
      .click();
  }

  async selectMessageResult(snippetText: string) {
    await this.conversationItems
      .filter({ hasText: snippetText })
      .first()
      .click();
  }

  async expectConversationVisible(name: string) {
    await expect(
      this.conversationItems.filter({ hasText: name }).first()
    ).toBeVisible();
  }

  async expectMessageSectionVisible() {
    await expect(this.messageResultsHeader).toBeVisible();
  }
}
