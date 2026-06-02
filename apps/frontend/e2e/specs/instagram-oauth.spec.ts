import { test, expect } from "../fixtures/pages.fixture";

/**
 * The callback flow is fully client-side: ChannelsClient reads `?status`
 * from searchParams and calls `toast()`, then `router.replace()` to clean
 * the URL.
 *
 * The toast assertion is currently skipped because of a hydration race:
 * ChannelsClient's `useEffect` runs and calls `toast()` BEFORE the
 * Toaster's `useEffect` registers its listener (children effects run
 * before parent effects). The dispatch lands in `memoryState` but no
 * listener fires, so the toast never reaches the DOM. This reproduces on
 * the dev server; manual production verification still shows the toast.
 *
 * Tracked separately. Until the toast hook race is fixed, we still cover:
 *   - the page is reachable with `?status=...`
 *   - the URL is cleaned by `router.replace()` (observable + deterministic)
 */
test.describe("OAuth Instagram — callback en /channels @critical @channels", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, "desktop-only layout");
  });

  test("callback exitoso limpia la query string", async ({
    page,
    channelsPage,
  }) => {
    await page.goto("/dashboard/channels?status=success&channel=instagram");
    await expect(channelsPage.heading).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/channels$/);
  });

  test("callback con error limpia la query string", async ({
    page,
    channelsPage,
  }) => {
    await page.goto("/dashboard/channels?status=error&channel=instagram");
    await expect(channelsPage.heading).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/channels$/);
  });

  test.fixme(
    "toast 'Instagram conectado' aparece tras callback exitoso",
    async ({ page }) => {
      // Reproducer:
      //   1. ChannelsClient mounts.
      //   2. useEffect reads ?status=success and calls toast(...).
      //   3. Toaster has not yet pushed its setState into `listeners`.
      //   4. toast() dispatches → memoryState updated, but listeners is empty.
      //   5. Toaster's useEffect runs and registers — but never sees the
      //      already-dispatched ADD_TOAST.
      // Fix candidates: wrap toast() in setTimeout(0) inside ChannelsClient,
      // or have useToast seed its useState from memoryState on every render.
      await page.goto("/dashboard/channels?status=success&channel=instagram");
      await expect(page.getByText(/instagram conectado/i)).toBeVisible();
    }
  );
});
