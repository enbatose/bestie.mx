import { test, expect } from "@playwright/test";

test.describe("Public marketing / legal pages", () => {
  test("FAQ page renders", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: /FAQ|Preguntas|frecuentes/i }).or(page.getByText(/pregunta/i)).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Terms and privacy pages render", async ({ page }) => {
    await page.goto("/legal/terminos");
    await expect(page.getByText(/Términos|Condiciones|Bestie/i).first()).toBeVisible();
    await page.goto("/legal/privacidad");
    await expect(page.getByText(/Privacidad|datos personales|Bestie/i).first()).toBeVisible();
  });
});
