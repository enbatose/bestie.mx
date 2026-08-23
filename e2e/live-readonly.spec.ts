import { test, expect } from "@playwright/test";
import { isMobileProject } from "./helpers";

/**
 * Read-only checks against a deployed origin.
 * Enable with: E2E_LIVE=1 E2E_BASE_URL=https://dev.bestie.mx npx playwright test
 *
 * Never creates accounts or listings. Runs on Desktop + Mobile Chrome projects.
 */
test.describe("Live read-only", () => {
  test.skip(!process.env.E2E_LIVE, "Set E2E_LIVE=1 to run against a deployed origin");

  test("home and search shell load", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
    await page.goto("/buscar/gdl");
    await expect(page).toHaveURL(/buscar/);

    if (isMobileProject(testInfo)) {
      await expect(page.getByRole("button", { name: "Mostrar listado" })).toBeVisible({
        timeout: 20_000,
      });
    }
  });

  test("public listing detail from live catalog", async ({ page, request }) => {
    const listings = await request.get("/api/listings");
    expect(listings.ok()).toBeTruthy();
    const body = (await listings.json()) as { id?: string }[];
    test.skip(body.length === 0, "No published listings on this environment");
    await page.goto(`/anuncio/${encodeURIComponent(body[0]!.id!)}`);
    await expect(page.locator("#root")).toBeVisible();
  });

  test("messaging APIs require a session and Mensajes shell loads", async ({ page, request }) => {
    await page.goto("/mensajes");
    await expect(page.locator("#root")).toBeVisible();

    const conversations = await request.get("/api/messages/conversations");
    expect(conversations.status()).toBe(401);
    const unread = await request.get("/api/messages/unread-count");
    expect(unread.status()).toBe(401);
    const safety = await request.get("/api/messages/safety-acknowledgment");
    expect(safety.status()).toBe(401);

    const listings = await request.get("/api/listings");
    expect(listings.ok()).toBeTruthy();
    const body = (await listings.json()) as { id?: string }[];
    test.skip(body.length === 0, "No published listings to probe A-ref contact");
    const roomId = body[0]!.id!;
    const slug = `A${roomId.replace(/^prp__/, "").replace(/-/g, "").toUpperCase().slice(0, 8)}`;
    const bySlug = await request.get(`/api/listings/${encodeURIComponent(slug)}`);
    expect(bySlug.ok()).toBeTruthy();
    const start = await request.post("/api/messages/conversations/from-listing", {
      data: { listingRoomId: slug },
    });
    expect(start.status()).toBe(401);
  });
});
