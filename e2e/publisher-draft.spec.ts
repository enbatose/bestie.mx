import { test, expect } from "@playwright/test";
import { createDraftProperty, registerViaUi, uniqueEmail } from "./helpers";

test.describe("Publisher draft (never published)", () => {
  test("create draft via API, see it in Mis anuncios, keep unpublished", async ({ page }) => {
    const email = uniqueEmail("pub");
    const password = "e2e-password-1";
    const api = page.context().request;

    await registerViaUi(page, email, password, "E2E Publisher");
    await expect(page).toHaveURL(/\/verificar-correo/);

    const link = await api.post("/api/auth/link-publisher");
    expect(link.ok()).toBeTruthy();

    const { propertyId } = await createDraftProperty(api);
    expect(propertyId.startsWith("prp__")).toBeTruthy();

    await page.goto("/mis-anuncios");
    await expect(page.getByText(/\[E2E\] Draft no publicar|Borrador/i).first()).toBeVisible({
      timeout: 25_000,
    });

    const catalog = await api.get("/api/listings");
    const listings = (await catalog.json()) as { propertyId?: string }[];
    expect(listings.some((l) => l.propertyId === propertyId)).toBeFalsy();
  });

  test("publish wizard shell loads without creating a listing", async ({ page }) => {
    await page.goto("/publicar");
    await expect(page).toHaveURL(/publicar/);
    // Prefer main content over the header nav link (often aria-hidden / overflow-clipped on mobile).
    await expect(page.getByRole("heading", { name: "Publicar", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/tipo de espacio|recámara|propiedad|Continuar|Siguiente/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
