import { test, expect } from "@playwright/test";
import { isMobileProject } from "./helpers";

test.describe("Browse & search", () => {
  test("home loads with brand and search CTA", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("#root")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Buscar" }).or(page.getByRole("link", { name: /Buscar|Guadalajara/i })).first(),
    ).toBeVisible({ timeout: 20_000 });

    if (isMobileProject(testInfo)) {
      const viewport = page.viewportSize();
      expect(viewport?.width ?? 0).toBeLessThan(500);
    }
  });

  test("search map page lists seeded Guadalajara inventory", async ({ page }, testInfo) => {
    await page.goto("/buscar/gdl");
    await expect(page).toHaveURL(/buscar/);

    if (isMobileProject(testInfo)) {
      // Prices live in the mobile list drawer (desktop sidebar is hidden under lg).
      await expect(page.getByText("GDL").or(page.getByText(/Guadalajara/i)).first()).toBeVisible({
        timeout: 25_000,
      });
      const showList = page.getByRole("button", { name: "Mostrar listado" });
      await expect(showList).toBeVisible({ timeout: 20_000 });
      await showList.click();
      await expect(page.getByRole("heading", { name: "Listados" })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/\$[\d,.]+/).first()).toBeVisible();
      await page.getByLabel("Cerrar listado").click();
      await expect(page.getByRole("heading", { name: "Listados" })).toBeHidden();
    } else {
      await expect(page.getByText(/Guadalajara|ZMG|anuncio|\$|MXN|mes/i).first()).toBeVisible({
        timeout: 25_000,
      });
    }
  });

  test("public listing API backs a detail page", async ({ page, request }) => {
    const listings = await request.get("/api/listings");
    expect(listings.ok()).toBeTruthy();
    const body = (await listings.json()) as { id?: string; title?: string }[];
    expect(body.length).toBeGreaterThan(0);
    const roomId = body[0]!.id!;

    await page.goto(`/anuncio/${encodeURIComponent(roomId)}`);
    await expect(page).toHaveURL(new RegExp(`/anuncio/${roomId}`));
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByText(/no encontrado|not found|404/i)).toHaveCount(0);
    await expect(page.locator("#root")).toContainText(/.{10,}/, { timeout: 20_000 });
  });
});
