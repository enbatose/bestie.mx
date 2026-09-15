import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatSink } from "./chatChannel.js";
import { openDb } from "./db.js";
import { findUserIdByVerifiedPhone } from "./phoneAuth.js";
import { processWhatsAppUserInput } from "./whatsappFlows.js";
import { getWhatsAppChat, upsertWhatsAppChat } from "./whatsappSessionStore.js";

const FROM = "5213318632070";
const PSID = `wa:${FROM}`;

function capturingSink(): { sink: ChatSink; texts: string[] } {
  const texts: string[] = [];
  return {
    texts,
    sink: {
      sendText: async (t) => {
        texts.push(t);
      },
      sendQuickReplies: async (t) => {
        texts.push(t);
      },
      sendListingCards: async (cards, footer) => {
        texts.push(cards.map((c) => c.title).join(" | "));
        texts.push(footer);
      },
      sendImage: async ({ caption }) => {
        if (caption) texts.push(caption);
      },
    },
  };
}

describe("WhatsApp bot flows", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-wa-bot-"));
    db = openDb(join(dir, "wa.db"));
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json, created_at, published_at
      ) VALUES (?, ?, 'published', 'room', 'Cuarto Centro Histórico', 'Guadalajara', 'Centro',
        20.6751, -103.3473, 'Resumen del espacio en el centro.', '523312345678', 1, '[]', ?, ?)`,
    ).run("prp__wa-centro-01", "pub-wa-seed", now, now);
    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary
      ) VALUES (?, ?, 'published', 'Recámara 1', 6200, 1, '[]', 'any', 18, 45, 'Resumen recámara centro.')`,
    ).run("wa-centro-room-01", "prp__wa-centro-01");
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("creates a Bestie account from the inbound WhatsApp number", async () => {
    const { sink } = capturingSink();
    await processWhatsAppUserInput(db, PSID, FROM, { text: "hola" }, sink);
    const userId = findUserIdByVerifiedPhone(db, "+523318632070");
    expect(userId).toBeTruthy();
    const s = getWhatsAppChat(db, PSID);
    expect(s?.flow).toBe("idle");
  });

  it("searches a GDL POI disk and returns the Centro listing", async () => {
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, `${PSID}-search`, FROM, { quickReplyPayload: "WA_SEARCH" }, sink);
    await processWhatsAppUserInput(db, `${PSID}-search`, FROM, { quickReplyPayload: "WA_POI:centro" }, sink);
    await processWhatsAppUserInput(db, `${PSID}-search`, FROM, { quickReplyPayload: "WA_BD:8000" }, sink);
    await processWhatsAppUserInput(db, `${PSID}-search`, FROM, { quickReplyPayload: "WA_PREF:any" }, sink);
    expect(texts.some((t) => t.includes("Cuarto Centro"))).toBe(true);
  });

  it("parses a free-text search for Centro + budget", async () => {
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(
      db,
      `${PSID}-blob`,
      FROM,
      { text: "busco cuarto cerca del centro hasta 8000" },
      sink,
    );
    const s = getWhatsAppChat(db, `${PSID}-blob`);
    expect(s?.draft.poiName).toBe("Centro");
    expect(s?.draft.budgetMax).toBe(8000);
    expect(texts.some((t) => /Preferencia|presupuesto/i.test(t))).toBe(true);
  });

  it("publishes a single room from photos + pin + rent + legal tap", async () => {
    const photo = "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
    const pubPsid = `${PSID}-pub`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_photos",
      draft: { ...chat.draft, photoUrls: [photo] },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_DONE" }, sink);
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      { location: { lat: 20.6746, lng: -103.3665, name: "Americana" } },
      sink,
    );
    await processWhatsAppUserInput(db, pubPsid, FROM, { text: "6500" }, sink);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUBLISH" }, sink);

    expect(texts.some((t) => t.includes("ya está público"))).toBe(true);
    const row = db
      .prepare(
        `SELECT p.contact_whatsapp, p.is_approximate_location, p.approximate_radius_m, r.rent_mxn, r.image_urls_json
         FROM properties p JOIN rooms r ON r.property_id = p.id
         WHERE r.image_urls_json LIKE '%aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg%' LIMIT 1`,
      )
      .get() as
      | {
          contact_whatsapp: string;
          is_approximate_location: number;
          approximate_radius_m: number;
          rent_mxn: number;
          image_urls_json: string;
        }
      | undefined;
    expect(row?.contact_whatsapp).toBe("523318632070");
    expect(row?.is_approximate_location).toBe(1);
    expect(row?.approximate_radius_m).toBeGreaterThanOrEqual(100);
    expect(JSON.parse(row?.image_urls_json ?? "[]")).toContain(photo);
  });
});
