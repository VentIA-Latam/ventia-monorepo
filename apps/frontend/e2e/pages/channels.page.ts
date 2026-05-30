import { type Page, type Locator, expect } from "@playwright/test";

type Filter = "all" | "whatsapp" | "instagram";

export class ChannelsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly connectButton: Locator;
  readonly emptyState: Locator;
  readonly grid: Locator;
  readonly filterPills: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Canales", level: 1 });
    this.connectButton = page.getByTestId("connect-channel-button");
    this.emptyState = page.getByTestId("channels-empty-state");
    this.grid = page.getByTestId("channels-grid");
    this.filterPills = page.getByTestId("channels-filter-pills");
  }

  async goto() {
    await this.page.goto("/dashboard/channels");
    // Either the empty state or the connect button confirms the page is ready.
    await Promise.race([
      this.emptyState.waitFor({ state: "visible" }),
      this.connectButton.waitFor({ state: "visible" }),
    ]);
  }

  pill(kind: Filter): Locator {
    return this.page.getByTestId(`filter-pill-${kind}`);
  }

  waCard(channelId: number): Locator {
    return this.page.getByTestId(`channel-card-wa-${channelId}`);
  }

  igCard(channelId: number): Locator {
    return this.page.getByTestId(`channel-card-ig-${channelId}`);
  }

  async openConnectDropdown() {
    await this.connectButton.click();
  }

  async clickConnectInstagram() {
    await this.openConnectDropdown();
    await this.page.getByTestId("connect-dropdown-instagram").click();
  }

  async clickConnectWhatsapp() {
    await this.openConnectDropdown();
    await this.page.getByTestId("connect-dropdown-whatsapp").click();
  }

  async selectFilter(kind: Filter) {
    await this.pill(kind).click();
  }

  async expectActiveFilter(kind: Filter) {
    await expect(this.pill(kind)).toHaveAttribute("data-active", "true");
  }

  async expectHeaderCount(total: number) {
    const text = total === 1 ? "1 canal conectado" : `${total} canales conectados`;
    await expect(this.page.getByText(text)).toBeVisible();
  }
}
