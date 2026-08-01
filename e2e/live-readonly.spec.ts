import { test, expect } from "@playwright/test";

/**
 * Read-only checks against a deployed origin.
 * Enable with: E2E_LIVE=1 E2E_BASE_URL=https://dev.bestie.mx npx playwright test
 *
 * Never creates accounts or listings.
 */
test.describe("Live read-only", () => {
  test.skip(!process.env.E2E_LIVE, "Set E2E_LIVE=1 to run against a deployed origin");

  test("home and search shell load", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
    await page.goto("/buscar/gdl");
    await expect(page).toHaveURL(/buscar/);
  });

  test("public listing detail from live catalog", async ({ page, request }) => {
    const listings = await request.get("/api/listings");
    expect(listings.ok()).toBeTruthy();
    const body = (await listings.json()) as { id?: string }[];
    test.skip(body.length === 0, "No published listings on this environment");
    await page.goto(`/anuncio/${encodeURIComponent(body[0]!.id!)}`);
    await expect(page.locator("#root")).toBeVisible();
  });
});
