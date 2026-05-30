import { test, expect } from "../fixtures/pages.fixture";

/**
 * Runs against the real backend. We click into the first WA conversation
 * and assert the composer's data-audio-format. Same for Instagram. If
 * either inbox has no conversations, the relevant test is skipped.
 */
test.describe("Voice notes — formato por canal @channels", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "composer layout differs on mobile");
  });

  test("conversación de WhatsApp: composer usa formato mp3", async ({
    page,
    conversationsPage,
  }) => {
    await conversationsPage.goto();

    const waConversation = page
      .getByTestId("conversation-item")
      .filter({
        has: page.locator(
          '[data-testid="conversation-channel-meta"][data-channel-kind="whatsapp"]'
        ),
      })
      .first();
    test.skip(
      (await waConversation.count()) === 0,
      "no WhatsApp conversations seeded"
    );
    await waConversation.scrollIntoViewIfNeeded();
    await waConversation.click();

    const composer = page.getByTestId("message-composer");
    await expect(composer).toBeVisible();
    await expect(composer).toHaveAttribute("data-audio-format", "mp3");
  });

  test("conversación de Instagram: composer usa formato wav", async ({
    page,
    conversationsPage,
  }) => {
    await conversationsPage.goto();

    const igConversation = page
      .getByTestId("conversation-item")
      .filter({
        has: page.locator(
          '[data-testid="conversation-channel-meta"][data-channel-kind="instagram"]'
        ),
      })
      .first();
    test.skip(
      (await igConversation.count()) === 0,
      "no Instagram conversations seeded"
    );
    await igConversation.scrollIntoViewIfNeeded();
    await igConversation.click();

    const composer = page.getByTestId("message-composer");
    await expect(composer).toBeVisible();
    await expect(composer).toHaveAttribute("data-audio-format", "wav");
  });
});
