import { type Page, type Locator, expect } from "@playwright/test";

export class MessageViewPage {
  readonly page: Page;
  readonly contactName: Locator;
  readonly searchButton: Locator;
  readonly scrollDownButton: Locator;
  readonly messagesContainer: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.contactName = page
      .locator("[class*='bg-muted/30']")
      .first()
      .locator("p.truncate")
      .first();
    this.searchButton = page.getByLabel("Buscar en conversación");
    this.scrollDownButton = page.getByLabel("Ir a los más recientes");
    this.messagesContainer = page.locator(
      "[class*='overflow-y-auto'][class*='overscroll-y-contain']"
    );
    this.backButton = page.locator("button:has(svg.lucide-arrow-left)");
  }

  async openSearch() {
    await this.searchButton.click();
  }

  async expectMessageHighlighted() {
    await expect(
      this.page.locator("[class*='bg-volt']").first()
    ).toBeVisible({ timeout: 5_000 });
  }

  async expectScrollDownVisible() {
    await expect(this.scrollDownButton).toBeVisible();
  }

  async expectScrollDownHidden() {
    await expect(this.scrollDownButton).toBeHidden();
  }

  async clickScrollDown() {
    await this.scrollDownButton.click();
  }

  async scrollUp(pixels: number = 500) {
    await this.messagesContainer.evaluate((el, px) => {
      el.scrollBy(0, -px);
    }, pixels);
    await this.page.waitForTimeout(200);
  }

  async goBack() {
    await this.backButton.click();
  }
}
