import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

export const PROP_SUMMARY_OK =
  "Descripción de la propiedad lo bastante larga para pruebas E2E de publicación (≥100 caracteres requeridos).";
export const ROOM_SUMMARY_OK =
  "Descripción del cuarto lo bastante larga para pruebas E2E de publicación (≥100 caracteres requeridos en el anuncio).";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/** True for Playwright projects whose name includes "mobile" (e.g. Mobile Chrome / Pixel 5). */
export function isMobileProject(testInfo: TestInfo): boolean {
  return /mobile/i.test(testInfo.project.name);
}

/** Create an unpublished draft via API (isolated e2e DB only — never publish). */
export async function createDraftProperty(request: APIRequestContext): Promise<{ propertyId: string }> {
  const create = await request.post("/api/properties", {
    data: {
      title: `[E2E] Draft no publicar ${Date.now()}`,
      city: "Guadalajara",
      neighborhood: "Centro",
      lat: 20.67,
      lng: -103.35,
      contactWhatsApp: "523331234567",
      summary: PROP_SUMMARY_OK,
    },
  });
  expect(create.ok(), await create.text()).toBeTruthy();
  const body = (await create.json()) as { id: string };
  const propertyId = body.id;

  const room = await request.post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`, {
    data: {
      title: "Cuarto E2E",
      rentMxn: 4500,
      roomsAvailable: 1,
      tags: [],
      roommateGenderPref: "any",
      ageMin: 18,
      ageMax: 99,
      summary: ROOM_SUMMARY_OK,
      imageUrls: ["/api/uploads/test-listing-photo.png"],
    },
  });
  expect(room.ok(), await room.text()).toBeTruthy();

  return { propertyId };
}

export async function registerViaUi(page: Page, email: string, password: string, name: string) {
  await page.goto("/registro");
  await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
  await page.getByLabel("Nombre para mostrar").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="password_confirm"]').fill(password);
  await page.getByRole("button", { name: "Registrarme" }).click();
  await expect(page).toHaveURL(/\/(verificar-correo|despues-de-entrar|perfil|mis-anuncios)(\?|$)/, {
    timeout: 20_000,
  });
}
