import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import {
  acceptSafetyModal,
  createPublishedListing,
  dismissCompleteProfileModalIfOpen,
  inboxRow,
  isMobileProject,
  newE2eContext,
  registerViaApi,
  uniqueEmail,
  unreadCount,
  verifyEmailViaDevCode,
} from "./helpers";

test.describe.configure({ timeout: 90_000 });

const PASSWORD = "e2e-password-1";

async function preparePublisher(
  context: BrowserContext,
): Promise<{ page: Page; request: APIRequestContext; email: string; listing: Awaited<ReturnType<typeof createPublishedListing>> }> {
  const page = await context.newPage();
  const request = context.request;
  const email = uniqueEmail("msg-pub");
  const registered = await registerViaApi(request, email, PASSWORD, "E2E Publisher Msg");
  await verifyEmailViaDevCode(request, registered.devCode);
  const linked = await request.post("/api/auth/link-publisher");
  expect(linked.ok(), await linked.text()).toBeTruthy();
  const listing = await createPublishedListing(request);
  return { page, request, email, listing };
}

async function prepareSeeker(context: BrowserContext): Promise<{ page: Page; request: APIRequestContext; email: string }> {
  const page = await context.newPage();
  const request = context.request;
  const email = uniqueEmail("msg-seek");
  const registered = await registerViaApi(request, email, PASSWORD, "E2E Seeker Msg");
  await verifyEmailViaDevCode(request, registered.devCode);
  return { page, request, email };
}

async function closeContexts(...contexts: BrowserContext[]) {
  await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
}

test.describe("Messaging (isolated)", () => {
  test("seeker contacts via A-ref URL, accepts safety notice, publisher replies", async ({
    browser,
  }) => {
    const pubCtx = await newE2eContext(browser);
    const seekCtx = await newE2eContext(browser);
    try {
      const publisher = await preparePublisher(pubCtx);
      const seeker = await prepareSeeker(seekCtx);
      const token = `e2e-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const publicListing = await seeker.request.get(
        `/api/listings/${encodeURIComponent(publisher.listing.publicSlug)}`,
      );
      expect(publicListing.ok(), await publicListing.text()).toBeTruthy();

      await seeker.page.goto(publisher.listing.publicPath);
      await expect(seeker.page).toHaveURL(new RegExp(`/anuncio/${publisher.listing.publicSlug}$`));
      await expect(seeker.page.getByText("Contactar anunciante")).toBeVisible({ timeout: 20_000 });
      await dismissCompleteProfileModalIfOpen(seeker.page);

      const box = seeker.page.getByLabel("Mensaje inicial");
      await expect(box).toBeVisible();
      await box.fill(`Hola, ${token}. ¿Sigue disponible?`);
      await seeker.page.getByRole("button", { name: "Enviar mensaje" }).click();

      await expect(seeker.page).toHaveURL(/\/mensajes\?c=/, { timeout: 25_000 });
      // Outbound-only threads do not gate yet — seeker can see their own send.
      await expect(seeker.page.getByRole("dialog", { name: "Protégete al chatear" })).toHaveCount(0);
      await expect(seeker.page.getByRole("article").getByText(token)).toBeVisible({ timeout: 15_000 });

      const started = await seeker.request.post("/api/messages/conversations/from-listing", {
        data: { listingRoomId: publisher.listing.publicSlug },
      });
      expect(started.ok(), await started.text()).toBeTruthy();
      const { conversationId } = (await started.json()) as { conversationId: string };
      expect(conversationId).toBeTruthy();

      const safety = await seeker.request.get("/api/messages/safety-acknowledgment");
      expect(safety.ok()).toBeTruthy();
      expect(((await safety.json()) as { accepted?: boolean }).accepted).toBe(false);

      expect(await unreadCount(publisher.request)).toBeGreaterThanOrEqual(1);
      const pubInbox = await inboxRow(publisher.request, conversationId);
      expect(pubInbox?.lastPreview).toBe("Nuevo mensaje");
      expect(pubInbox?.unreadCount).toBeGreaterThanOrEqual(1);

      await publisher.page.goto(`/mensajes?c=${encodeURIComponent(conversationId)}`);
      await acceptSafetyModal(publisher.page, {
        expectTip: "No compartas CLABE",
      });
      await expect(publisher.page.getByRole("article").getByText(token)).toBeVisible({ timeout: 15_000 });

      const pubInboxAfterAck = await inboxRow(publisher.request, conversationId);
      expect(pubInboxAfterAck?.lastPreview).toContain(token);

      const reply = `recibido-${token}`;
      await publisher.page.locator("#msg-body").fill(reply);
      await publisher.page.getByRole("button", { name: "Enviar" }).click();
      await expect(publisher.page.getByRole("article").getByText(reply)).toBeVisible({ timeout: 15_000 });

      expect(await unreadCount(seeker.request)).toBeGreaterThanOrEqual(1);

      await seeker.page.reload();
      await acceptSafetyModal(seeker.page, {
        expectTip: "No pagues depósito ni renta",
      });
      await expect(seeker.page.getByRole("article").getByText(reply)).toBeVisible({ timeout: 15_000 });

      const thread = await seeker.request.get(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
      );
      expect(thread.ok(), await thread.text()).toBeTruthy();
      const bodies = ((await thread.json()) as { messages: { body: string }[] }).messages.map((m) => m.body);
      expect(bodies.some((b) => b.includes(token))).toBeTruthy();
      expect(bodies.some((b) => b.includes(reply))).toBeTruthy();
    } finally {
      await closeContexts(pubCtx, seekCtx);
    }
  });

  test("publisher cannot message their own listing", async ({ browser }) => {
    const pubCtx = await newE2eContext(browser);
    try {
      const publisher = await preparePublisher(pubCtx);
      await publisher.page.goto(publisher.listing.publicPath);
      await expect(publisher.page.getByText("Contactar anunciante")).toBeVisible({ timeout: 20_000 });
      await dismissCompleteProfileModalIfOpen(publisher.page);
      await publisher.page.getByRole("button", { name: "Enviar mensaje" }).click();
      await expect(
        publisher.page.getByText("El usuario anunciante no puede abrir una conversación consigo mismo."),
      ).toBeVisible({ timeout: 15_000 });
      await expect(publisher.page).not.toHaveURL(/\/mensajes/);
    } finally {
      await closeContexts(pubCtx);
    }
  });

  test("anonymous seeker is asked to sign in before messaging", async ({ page, browser }) => {
    const pubCtx = await newE2eContext(browser);
    try {
      const publisher = await preparePublisher(pubCtx);
      await page.goto(publisher.listing.publicPath);
      await expect(page.getByRole("button", { name: /Enviar mensaje/ })).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: /Enviar mensaje/ }).click();
      await expect(page.getByRole("dialog", { name: /Iniciar sesión|Regístrate/ })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page).not.toHaveURL(/\/mensajes/);
    } finally {
      await closeContexts(pubCtx);
    }
  });

  test("API: A-ref start, safety ack, draft blocked, support exempt", async ({
    browser,
  }, testInfo) => {
    test.skip(isMobileProject(testInfo), "API contract runs once on desktop");

    const pubCtx = await newE2eContext(browser);
    const seekCtx = await newE2eContext(browser);
    try {
      const publisher = await preparePublisher(pubCtx);
      const seeker = await prepareSeeker(seekCtx);

      const anon = await newE2eContext(browser);
      try {
        const anonConv = await anon.request.get("/api/messages/conversations");
        expect(anonConv.status()).toBe(401);
        const anonSafety = await anon.request.get("/api/messages/safety-acknowledgment");
        expect(anonSafety.status()).toBe(401);
        const anonStart = await anon.request.post("/api/messages/conversations/from-listing", {
          data: { listingRoomId: publisher.listing.publicSlug },
        });
        expect(anonStart.status()).toBe(401);
      } finally {
        await anon.close();
      }

      const viaSlug = await seeker.request.post("/api/messages/conversations/from-listing", {
        data: { listingRoomId: publisher.listing.publicSlug },
      });
      expect(viaSlug.ok(), await viaSlug.text()).toBeTruthy();
      const { conversationId } = (await viaSlug.json()) as { conversationId: string };

      const viaUuid = await seeker.request.post("/api/messages/conversations/from-listing", {
        data: { listingRoomId: publisher.listing.roomId },
      });
      expect(viaUuid.ok(), await viaUuid.text()).toBeTruthy();
      expect(((await viaUuid.json()) as { conversationId: string }).conversationId).toBe(conversationId);

      const invalid = await seeker.request.post("/api/messages/conversations/from-listing", {
        data: { listingRoomId: "not-a-valid-listing-id!!!" },
      });
      expect(invalid.status()).toBe(400);

      const sent = await seeker.request.post(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
        { data: { body: "primer inbound para gate" } },
      );
      expect(sent.ok(), await sent.text()).toBeTruthy();

      const empty = await seeker.request.post(
        `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
        { data: { body: "   " } },
      );
      expect(empty.status()).toBe(400);

      const beforeAck = await seeker.request.get("/api/messages/safety-acknowledgment");
      expect(((await beforeAck.json()) as { accepted?: boolean }).accepted).toBe(false);
      expect((await inboxRow(seeker.request, conversationId))?.lastPreview).toBe("Nuevo mensaje");
      expect((await inboxRow(publisher.request, conversationId))?.lastPreview).toBe("Nuevo mensaje");
      expect(await unreadCount(publisher.request)).toBeGreaterThanOrEqual(1);

      const strangerCtx = await newE2eContext(browser);
      try {
        const stranger = await prepareSeeker(strangerCtx);
        const stolenList = await stranger.request.get("/api/messages/conversations");
        expect(stolenList.ok()).toBeTruthy();
        const stolenRows = ((await stolenList.json()) as { conversations: { id: string }[] }).conversations;
        expect(stolenRows.some((row) => row.id === conversationId)).toBeFalsy();
        const stolenThread = await stranger.request.get(
          `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
        );
        expect(stolenThread.status()).toBe(404);
        const stolenSend = await stranger.request.post(
          `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
          { data: { body: "no deberia entrar" } },
        );
        expect(stolenSend.status()).toBe(404);
      } finally {
        await strangerCtx.close();
      }

      const ack = await seeker.request.post("/api/messages/safety-acknowledgment", {
        data: { conversationId, role: "seeker" },
      });
      expect(ack.ok(), await ack.text()).toBeTruthy();
      const afterAck = await seeker.request.get("/api/messages/safety-acknowledgment");
      expect(((await afterAck.json()) as { accepted?: boolean }).accepted).toBe(true);
      expect((await inboxRow(seeker.request, conversationId))?.lastPreview).toContain("primer inbound");

      const support = await seeker.request.post("/api/messages/conversations/from-support", {
        data: { subject: "E2E support", body: "Hola soporte e2e" },
      });
      expect(support.ok(), await support.text()).toBeTruthy();
      const supportId = ((await support.json()) as { conversationId: string }).conversationId;
      await seeker.page.goto(`/mensajes?c=${encodeURIComponent(supportId)}`);
      await expect(seeker.page.getByText(/Soporte de Bestie|Soporte/i).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(seeker.page.getByRole("dialog", { name: "Protégete al chatear" })).toHaveCount(0);

      const draft = await publisher.request.post("/api/properties", {
        data: {
          title: `[E2E-MSG] Draft ${Date.now()}`,
          city: "Guadalajara",
          neighborhood: "Centro",
          lat: 20.67,
          lng: -103.35,
          contactWhatsApp: "523331234567",
          summary:
            "Descripción de la propiedad lo bastante larga para pruebas E2E de publicación (≥100 caracteres requeridos).",
        },
      });
      expect(draft.ok()).toBeTruthy();
      const draftPropId = ((await draft.json()) as { id: string }).id;
      const draftRoom = await publisher.request.post(
        `/api/properties/${encodeURIComponent(draftPropId)}/rooms`,
        {
          data: {
            title: "Draft room",
            rentMxn: 3000,
            roomsAvailable: 1,
            tags: [],
            roommateGenderPref: "any",
            ageMin: 18,
            ageMax: 40,
            summary:
              "Descripción del cuarto lo bastante larga para pruebas E2E de publicación (≥100 caracteres requeridos en el anuncio).",
          },
        },
      );
      expect(draftRoom.ok()).toBeTruthy();
      const draftRoomId = ((await draftRoom.json()) as { id: string }).id;
      const blocked = await seeker.request.post("/api/messages/conversations/from-listing", {
        data: { listingRoomId: draftRoomId },
      });
      expect(blocked.status()).toBe(404);
    } finally {
      await closeContexts(pubCtx, seekCtx);
    }
  });
});
