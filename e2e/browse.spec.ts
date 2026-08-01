import { test, expect } from "@playwright/test";

test.describe("Browse & search", () => {
  test("home loads with brand and search CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Buscar" }).or(page.getByRole("link", { name: /Buscar|Guadalajara/i })).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("search map page lists seeded Guadalajara inventory", async ({ page }) => {
    await page.goto("/buscar/gdl");
    await expect(page).toHaveURL(/buscar/);
    await expect(page.getByText(/Guadalajara|ZMG|anuncio|\$|MXN|mes/i).first()).toBeVisible({
      timeout: 25_000,
    });
  });

  test("public listing API backs a detail page", async ({ page, request }) => {
    const listings = await request.get("/api/listings");
    expect(listings.ok()).toBeTruthy();
    const body = (await listings.json()) as { id?: string; title?: string }[];
    expect(body.length).toBeGreaterThan(0);
    const roomId = body[0]!.id!;
    const title = body[0]!.title;

    await page.goto(`/anuncio/${encodeURIComponent(roomId)}`);
    await expect(page).toHaveURL(new RegExp(`/anuncio/${roomId}`));
    await expect(page.locator("#root")).toBeVisible();
    // Detail pages render asynchronously; assert we did not land on a hard error shell.
    await expect(page.getByText(/no encontrado|not found|404/i)).toHaveCount(0);
    await expect(page.locator("#root")).toContainText(/.{10,}/, { timeout: 20_000 });
  });
});
