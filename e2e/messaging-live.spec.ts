import { test, expect } from "@playwright/test";
import { acceptSafetyModal, clickMessagesSendButton, dismissCompleteProfileModalIfOpen, loginViaApi, newE2eContext, roomPublicSlug } from "./helpers";

/**
 * Authenticated messaging against a deployed origin.
 * Never creates listings or registers accounts.
 *
 * Required env:
 *   E2E_LIVE=1
 *   E2E_MESSAGING_LIVE=1
 *   E2E_MSG_SEEKER_EMAIL / E2E_MSG_SEEKER_PASSWORD
 *   E2E_MSG_PUBLISHER_EMAIL / E2E_MSG_PUBLISHER_PASSWORD
 *   E2E_MSG_LISTING_ID  — UUID or public A… slug owned by the publisher
 */
const enabled =
  Boolean(process.env.E2E_LIVE) &&
  Boolean(process.env.E2E_MESSAGING_LIVE) &&
  Boolean(process.env.E2E_MSG_SEEKER_EMAIL) &&
  Boolean(process.env.E2E_MSG_SEEKER_PASSWORD) &&
  Boolean(process.env.E2E_MSG_PUBLISHER_EMAIL) &&
  Boolean(process.env.E2E_MSG_PUBLISHER_PASSWORD) &&
  Boolean(process.env.E2E_MSG_LISTING_ID);

test.describe("Live messaging (fixture accounts)", () => {
  test.skip(!enabled, "Set E2E_MESSAGING_LIVE plus fixture account env vars");
  test.describe.configure({ timeout: 90_000 });

  test("seeker ↔ publisher thread on the live listing", async ({ browser }) => {
    const listingId = process.env.E2E_MSG_LISTING_ID!.trim();
    const slug = roomPublicSlug(listingId);
    const token = `live-msg-${Date.now()}`;

    const seekCtx = await newE2eContext(browser);
    const pubCtx = await newE2eContext(browser);
    try {
      await loginViaApi(seekCtx.request, process.env.E2E_MSG_SEEKER_EMAIL!, process.env.E2E_MSG_SEEKER_PASSWORD!);
      await loginViaApi(
        pubCtx.request,
        process.env.E2E_MSG_PUBLISHER_EMAIL!,
        process.env.E2E_MSG_PUBLISHER_PASSWORD!,
      );

      const seekPage = await seekCtx.newPage();
      await seekPage.goto(`/anuncio/${encodeURIComponent(slug)}`);
      await expect(seekPage.getByText("Contactar anunciante")).toBeVisible({ timeout: 25_000 });
      await seekPage.getByLabel("Mensaje inicial").fill(`Hola, ${token}`);
      await seekPage.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(seekPage).toHaveURL(/\/mensajes\?c=/, { timeout: 25_000 });
      await expect(seekPage.getByRole("article").getByText(token)).toBeVisible({ timeout: 15_000 });

      const started = await seekCtx.request.post("/api/messages/conversations/from-listing", {
        data: { listingRoomId: slug },
      });
      expect(started.ok(), await started.text()).toBeTruthy();
      const { conversationId } = (await started.json()) as { conversationId: string };

      const pubPage = await pubCtx.newPage();
      await pubPage.goto(`/mensajes?c=${encodeURIComponent(conversationId)}`);
      await dismissCompleteProfileModalIfOpen(pubPage);
      const dialog = pubPage.getByRole("dialog", { name: "Protégete al chatear" });
      if (await dialog.isVisible().catch(() => false)) {
        await acceptSafetyModal(pubPage);
      }
      await expect(pubPage.getByRole("article").getByText(token)).toBeVisible({ timeout: 20_000 });

      const reply = `ok-${token}`;
      await pubPage.locator("#msg-body").fill(reply);
      await clickMessagesSendButton(pubPage);
      await expect(pubPage.getByRole("article").getByText(reply)).toBeVisible({ timeout: 15_000 });

      await seekPage.reload();
      if (await seekPage.getByRole("dialog", { name: "Protégete al chatear" }).isVisible().catch(() => false)) {
        await acceptSafetyModal(seekPage);
      }
      await expect(seekPage.getByRole("article").getByText(reply)).toBeVisible({ timeout: 20_000 });
    } finally {
      await Promise.all([seekCtx.close(), pubCtx.close()]);
    }
  });
});
