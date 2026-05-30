import { test } from "../fixtures/pages.fixture";

/**
 * Empty state requires zero connected channels. The dev backend always has
 * seeded channels (WhatsApp + Instagram), so we can't reach this state from
 * a browser-only test. Skipped intentionally — covered by component-level
 * snapshots if needed.
 */
test.describe.skip("Canales — empty state @critical @channels", () => {
  test("muestra hero, dos tiles y CTAs cuando no hay canales", () => {});
  test("CTA de Instagram navega a la página de consent", () => {});
});
