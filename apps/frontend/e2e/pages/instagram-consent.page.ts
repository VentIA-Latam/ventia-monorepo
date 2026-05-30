import type { Page } from "@playwright/test";

/**
 * `/dashboard/instagram-connect/consent` is a Next.js Route Handler that:
 *  1. Calls the backend `GET /messaging/instagram/authorize`.
 *  2. Reads `authorize_url` from the JSON response.
 *  3. Redirects (302) to that URL.
 *
 * There's no HTML page to assert on — the POM exists to express intent
 * (the test wants to land here) and to provide a `goto()` for the case
 * where the test mocks `/authorize` and asserts a downstream navigation.
 */
export class InstagramConsentPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/dashboard/instagram-connect/consent", {
      waitUntil: "commit",
    });
  }
}
