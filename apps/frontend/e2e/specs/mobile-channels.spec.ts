import { test, expect } from "../fixtures/pages.fixture";

test.describe("Mobile — vista de canales @mobile @channels", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, "mobile-only spec");
  });

  test("/channels: header y al menos un card visible en viewport mobile", async ({
    page,
    channelsPage,
  }) => {
    await channelsPage.goto();

    await expect(channelsPage.heading).toBeVisible();

    const anyCard = page.locator('[data-testid^="channel-card-"]').first();
    test.skip(
      (await anyCard.count()) === 0,
      "no channels seeded"
    );
    await anyCard.scrollIntoViewIfNeeded();
    await expect(anyCard).toBeVisible();
  });

  test("/conversations: filtro de bandejas se puede abrir y usar en mobile", async ({
    page,
    conversationsPage,
  }) => {
    await conversationsPage.goto();

    try {
      await conversationsPage.inboxFilterTrigger.waitFor({
        state: "attached",
        timeout: 5_000,
      });
    } catch {
      test.skip(true, "requires more than one inbox seeded");
    }

    await conversationsPage.openInboxFilter();
    await expect(conversationsPage.inboxFilterAllToggle).toBeVisible();
    await expect(
      page.locator('[data-testid="inbox-filter-option"]').first()
    ).toBeVisible();

    // Toggle off the first option and confirm aria-checked flips.
    const firstOption = page.locator('[data-testid="inbox-filter-option"]').first();
    await firstOption.click();
    await expect(firstOption).toHaveAttribute("aria-checked", "false");
  });
});
