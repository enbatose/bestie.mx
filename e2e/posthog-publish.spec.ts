import { test, expect } from "@playwright/test";

/**
 * Guards PostHog wiring on publish surfaces without sending Dev traffic into PostHog.
 *
 * Local / Dev / previews: must never call PostHog ingestion hosts.
 * Production (bestie.mx / www): must initialize PostHog when a token is present.
 *
 * Live runs: E2E_LIVE=1 E2E_BASE_URL=https://dev.bestie.mx|https://www.bestie.mx
 */

const POSTHOG_URL_RE = /posthog\.com|i\.posthog\.com/i;

function hostnameFromBase(baseURL: string | undefined): string {
  try {
    return new URL(baseURL || "http://127.0.0.1").hostname.toLowerCase();
  } catch {
    return "127.0.0.1";
  }
}

function isProductionAnalyticsHost(hostname: string): boolean {
  return hostname === "bestie.mx" || hostname === "www.bestie.mx";
}

test.describe("PostHog publish surfaces", () => {
  test("publish wizard respects prod-only PostHog capture", async ({ page }, testInfo) => {
    const hostname = hostnameFromBase(testInfo.project.use.baseURL);
    const expectCapture = isProductionAnalyticsHost(hostname);
    const posthogUrls: string[] = [];

    page.on("request", (req) => {
      if (POSTHOG_URL_RE.test(req.url())) posthogUrls.push(req.url());
    });

    await page.goto("/publicar");
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByRole("heading", { name: /publicar/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Give the SPA a moment to init analytics (or prove it stays silent).
    await page.waitForTimeout(2500);

    if (expectCapture) {
      expect(
        posthogUrls.length,
        `Prod (${hostname}) should contact PostHog from /publicar`,
      ).toBeGreaterThan(0);
    } else {
      expect(
        posthogUrls,
        `Non-prod (${hostname}) must not send PostHog traffic from /publicar`,
      ).toEqual([]);
    }
  });

  test("assisted claim shell respects prod-only PostHog capture", async ({ page }, testInfo) => {
    const hostname = hostnameFromBase(testInfo.project.use.baseURL);
    const expectCapture = isProductionAnalyticsHost(hostname);
    const posthogUrls: string[] = [];

    page.on("request", (req) => {
      if (POSTHOG_URL_RE.test(req.url())) posthogUrls.push(req.url());
    });

    // Invalid token still mounts the claim page (loading/error) and runs the recording helper.
    await page.goto("/borrador/e2e-posthog-probe-token");
    await expect(page.locator("#root")).toBeVisible();
    await page.waitForTimeout(2500);

    if (expectCapture) {
      expect(
        posthogUrls.length,
        `Prod (${hostname}) should contact PostHog from /borrador`,
      ).toBeGreaterThan(0);
    } else {
      expect(
        posthogUrls,
        `Non-prod (${hostname}) must not send PostHog traffic from /borrador`,
      ).toEqual([]);
    }
  });
});
