import { type Page, type Locator, expect } from "@playwright/test";

type ChannelKind = "whatsapp" | "instagram" | "other";

export class ConversationsPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly clearSearchButton: Locator;
  readonly conversationItems: Locator;
  readonly messageResultsHeader: Locator;
  readonly inboxFilterTrigger: Locator;
  readonly inboxFilterAllToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder("Buscar o iniciar chat");
    this.clearSearchButton = page.getByLabel("Limpiar búsqueda");
    this.conversationItems = page.getByTestId("conversation-item");
    this.messageResultsHeader = page
      .locator("div.uppercase")
      .filter({ hasText: "Mensajes" });
    this.inboxFilterTrigger = page.getByTestId("inbox-filter-trigger");
    this.inboxFilterAllToggle = page.getByTestId("inbox-filter-all");
  }

  async goto() {
    await this.page.goto("/dashboard/conversations");
    await expect(this.searchInput).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Fill the search input. The actual result rendering is verified by the
   * subsequent assertion's auto-wait; we just give the debounce time to fire.
   */
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

  // --- Inbox filter ---------------------------------------------------

  async openInboxFilter() {
    await this.inboxFilterTrigger.click();
    await this.inboxFilterAllToggle.waitFor({ state: "visible" });
  }

  /** Click the option for a specific inbox by id. The popover must be open. */
  async toggleInboxOption(inboxId: number) {
    await this.page
      .locator(`[data-testid="inbox-filter-option"][data-inbox-id="${inboxId}"]`)
      .click();
  }

  /** Locator for all inbox options of a given channel kind. */
  inboxOptions(kind: ChannelKind): Locator {
    return this.page.locator(
      `[data-testid="inbox-filter-option"][data-channel-kind="${kind}"]`
    );
  }

  async expectInboxGroupVisible(kind: ChannelKind) {
    await expect(this.inboxOptions(kind).first()).toBeVisible();
  }

  conversationItem(id: number): Locator {
    return this.page.locator(`[data-testid="conversation-item"][data-conversation-id="${id}"]`);
  }

  conversationChannelMeta(conversationId: number): Locator {
    return this.conversationItem(conversationId).getByTestId(
      "conversation-channel-meta"
    );
  }
}
