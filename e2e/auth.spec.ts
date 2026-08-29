import { test, expect } from "@playwright/test";
import { dismissCompleteProfileModalIfOpen, registerViaUi, uniqueEmail } from "./helpers";

test.describe("Auth email/password", () => {
  test("register → verify screen → logout → login", async ({ page }) => {
    const email = uniqueEmail("auth");
    const password = "e2e-password-1";

    await registerViaUi(page, email, password, "E2E Tester");
    await expect(page).toHaveURL(/\/verificar-correo/);
    await expect(page.getByRole("heading", { name: /Verificar|correo/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/entrar");
    const logout = page.getByRole("button", { name: "Cerrar sesión" });
    const entrarHeading = page.getByRole("heading", { name: "Entrar" });
    // Wait past the "Cargando…" shell — a same-tick isVisible() on logout races
    // authMe() and then never sees the login form (CI flake on Mobile Chrome).
    await expect(logout.or(entrarHeading)).toBeVisible({ timeout: 15_000 });
    await dismissCompleteProfileModalIfOpen(page);
    if (await logout.isVisible().catch(() => false)) {
      await logout.click();
    }
    await expect(entrarHeading).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Correo o celular").fill(email);
    await page.locator('input[autocomplete="current-password"], input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("button", { name: "Cerrar sesión" }).or(page.getByText(email))).toBeVisible({
      timeout: 20_000,
    });
  });
});
