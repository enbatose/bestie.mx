import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
} from "../src/lib/cookieConsent";

export const PROP_SUMMARY_OK =
  "Descripción de la propiedad lo bastante larga para pruebas E2E de publicación (≥100 caracteres requeridos).";
export const ROOM_SUMMARY_OK =
  "Descripción del cuarto lo bastante larga para pruebas E2E de publicación (≥100 caracteres requeridos en el anuncio).";

/**
 * Pre-decide cookie consent so the bottom banner cannot intercept clicks
 * (Mostrar listado, Enviar, etc.) in CI.
 */
export function e2eCookieConsentStorageState(origin: string) {
  return {
    cookies: [] as { name: string; value: string; domain: string; path: string }[],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: COOKIE_CONSENT_STORAGE_KEY,
            value: JSON.stringify({
              version: COOKIE_CONSENT_VERSION,
              analytics: false,
              marketing: false,
              decidedAt: "2026-01-01T00:00:00.000Z",
            }),
          },
        ],
      },
    ],
  };
}

/** New context with consent seeded (for specs that call `browser.newContext`). */
export async function newE2eContext(
  browser: Browser,
  origin = new URL(process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 4177}`).origin,
): Promise<BrowserContext> {
  return browser.newContext({ storageState: e2eCookieConsentStorageState(origin) });
}

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

/** Skip the post-login phone prompt so it cannot intercept clicks in CI. */
export async function dismissPhonePromptViaApi(request: APIRequestContext): Promise<void> {
  const res = await request.patch("/api/auth/me", { data: { dismissPhonePrompt: true } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** UI fallback when a logged-in page may still show the phone prompt. */
export async function dismissCompleteProfileModalIfOpen(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Agrega tu teléfono" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "Ahora no" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }
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
  await dismissPhonePromptViaApi(page.context().request);
}

export type RegisterApiResult = {
  id: string;
  email: string;
  displayName: string;
  devCode?: string;
};

export async function registerViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
  displayName: string,
): Promise<RegisterApiResult> {
  const res = await request.post("/api/auth/register", {
    data: { email, password, displayName },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as RegisterApiResult;
  await dismissPhonePromptViaApi(request);
  return body;
}

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const res = await request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  await dismissPhonePromptViaApi(request);
}

export async function verifyEmailViaDevCode(
  request: APIRequestContext,
  devCode: string | undefined,
): Promise<void> {
  if (!devCode) return;
  const res = await request.post("/api/auth/email/verify", { data: { code: devCode } });
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** Public room slug used in `/anuncio/A…` (same algorithm as `listingPublicPath`). */
export function roomPublicSlug(roomId: string): string {
  const parsed = roomId.trim().match(/^A([A-F0-9]{8})$/i);
  if (parsed) return `A${parsed[1]!.toUpperCase()}`;
  const hex = roomId.replace(/^prp__/, "").replace(/-/g, "").toUpperCase();
  const runs = hex.match(/[A-F0-9]{8,}/g);
  const slice = (runs?.[runs.length - 1] ?? hex).slice(0, 8);
  return `A${slice}`;
}

export type PublishedListingIds = {
  propertyId: string;
  roomId: string;
  publicSlug: string;
  publicPath: string;
};

/**
 * Create a published, contactable room listing (isolated e2e DB only).
 * Caller must already be an authenticated user with a linked publisher.
 */
export async function createPublishedListing(
  request: APIRequestContext,
  opts?: { title?: string; rentMxn?: number },
): Promise<PublishedListingIds> {
  const title = opts?.title ?? `[E2E-MSG] Cuarto ${Date.now()}`;
  const create = await request.post("/api/properties", {
    data: {
      title,
      city: "Guadalajara",
      neighborhood: "Centro",
      lat: 20.67,
      lng: -103.35,
      contactWhatsApp: "523331234567",
      summary: PROP_SUMMARY_OK,
      postMode: "room",
    },
  });
  expect(create.ok(), await create.text()).toBeTruthy();
  const propertyId = ((await create.json()) as { id: string }).id;

  const room = await request.post(`/api/properties/${encodeURIComponent(propertyId)}/rooms`, {
    data: {
      title: "Recámara E2E",
      rentMxn: opts?.rentMxn ?? 4600,
      roomsAvailable: 1,
      tags: ["wifi"],
      roommateGenderPref: "any",
      ageMin: 18,
      ageMax: 40,
      summary: ROOM_SUMMARY_OK,
      imageUrls: ["/api/uploads/test-listing-photo.png"],
    },
  });
  expect(room.ok(), await room.text()).toBeTruthy();
  const roomBody = (await room.json()) as { id: string };
  const roomId = roomBody.id;

  const photo = await request.patch(
    `/api/properties/${encodeURIComponent(propertyId)}/rooms/${encodeURIComponent(roomId)}`,
    { data: { imageUrls: ["/api/uploads/test-listing-photo.png"] } },
  );
  expect(photo.ok(), await photo.text()).toBeTruthy();

  const pubProp = await request.patch(`/api/properties/${encodeURIComponent(propertyId)}`, {
    data: { status: "published", postMode: "room", imageUrls: ["/api/uploads/test-listing-photo.png"] },
  });
  expect(pubProp.ok(), await pubProp.text()).toBeTruthy();

  const pubRoom = await request.patch(`/api/listings/${encodeURIComponent(roomId)}`, {
    data: { status: "published" },
  });
  expect(pubRoom.ok(), await pubRoom.text()).toBeTruthy();

  const publicSlug = roomPublicSlug(roomId);
  const catalog = await request.get("/api/listings");
  expect(catalog.ok(), await catalog.text()).toBeTruthy();
  const publicRows = (await catalog.json()) as { id?: string }[];
  expect(
    publicRows.some((row) => row.id === roomId),
    "published room must appear in GET /api/listings (owner-only GET is not enough)",
  ).toBeTruthy();
  return { propertyId, roomId, publicSlug, publicPath: `/anuncio/${publicSlug}` };
}

export async function acceptMessagingSafety(
  request: APIRequestContext,
  conversationId?: string,
  role: "seeker" | "publisher" = "seeker",
): Promise<void> {
  const res = await request.post("/api/messages/safety-acknowledgment", {
    data: { conversationId, role },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

export async function unreadCount(request: APIRequestContext): Promise<number> {
  const res = await request.get("/api/messages/unread-count");
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { count?: number }).count ?? 0;
}

export async function inboxRow(
  request: APIRequestContext,
  conversationId: string,
): Promise<{ lastPreview?: string; unreadCount?: number; id: string } | undefined> {
  const res = await request.get("/api/messages/conversations");
  expect(res.ok(), await res.text()).toBeTruthy();
  const rows = ((await res.json()) as { conversations: { lastPreview?: string; unreadCount?: number; id: string }[] })
    .conversations;
  return rows.find((row) => row.id === conversationId);
}

export async function acceptSafetyModal(
  page: Page,
  opts?: { expectTip?: string | RegExp },
): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Protégete al chatear" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  if (opts?.expectTip) {
    await expect(dialog.getByText(opts.expectTip).first()).toBeVisible();
  }
  await dialog.getByText("He leído y acepto este aviso").click();
  await dialog.getByRole("button", { name: "Entiendo y continuar" }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
