import { test, expect } from "../fixtures/pages.fixture";
import { fakeInstagramChannel } from "../fixtures/messaging-mocks";

/**
 * Contract test: keep the mock factory honest against the real backend.
 *
 * This spec is meant to run only when the backend is reachable AND the test
 * user has at least one Instagram channel connected. It is tagged @contract
 * and skipped by default; run with `pnpm test:e2e:desktop --grep @contract`.
 *
 * Prereqs:
 *   - `BACKEND_URL` env var (defaults to http://localhost:8000)
 *   - `BACKEND_TEST_TOKEN` env var with a valid JWT for the test tenant
 *   - The tenant has at least one connected Instagram channel
 */
test.describe("Instagram channel contract @contract @nightly", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.BACKEND_TEST_TOKEN,
      "BACKEND_TEST_TOKEN not set — skipping contract test"
    );
  });

  test("mock shape matches real /messaging/instagram/status response", async ({
    request,
  }) => {
    const baseUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    const response = await request.get(`${baseUrl}/api/v1/messaging/instagram/status`, {
      headers: {
        Authorization: `Bearer ${process.env.BACKEND_TEST_TOKEN}`,
      },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    const realChannel = body.data[0];
    const mockChannel = fakeInstagramChannel();

    expect(Object.keys(realChannel).sort()).toEqual(
      Object.keys(mockChannel).sort()
    );

    for (const key of Object.keys(mockChannel) as Array<
      keyof typeof mockChannel
    >) {
      expect(typeof realChannel[key]).toBe(typeof mockChannel[key]);
    }
  });
});
