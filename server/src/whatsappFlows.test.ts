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

  it("returns matches on the zone tap, without a budget or preference interview", async () => {
    const { sink, texts } = capturingSink();
    const psid = `${PSID}-search`;
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_SEARCH" }, sink);
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_POI:centro" }, sink);
    expect(texts.some((t) => t.includes("Cuarto Centro"))).toBe(true);
    // Budget and preference are refinements offered after results, not gates.
    expect(texts.some((t) => /Presupuesto mensual máximo/.test(t))).toBe(false);
    expect(getWhatsAppChat(db, psid)?.flow).toBe("idle");
  });

  it("states how much more Bestie has, not only the exact matches", async () => {
    const { sink, texts } = capturingSink();
    const psid = `${PSID}-inventory`;
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_SEARCH" }, sink);
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_POI:centro" }, sink);
    expect(texts.some((t) => /anuncios? en Centro/.test(t) && /Guadalajara/.test(t))).toBe(true);
  });

  it("parses a free-text search for Centro + budget and answers with listings", async () => {
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
    expect(texts.some((t) => t.includes("Cuarto Centro"))).toBe(true);
  });

  async function skipToPhotos(psid: string, sink: ReturnType<typeof capturingSink>["sink"]) {
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_INFO_NO" }, sink);
  }

  it("lets you skip photos and continue the publish flow", async () => {
    const pubPsid = `${PSID}-skip-photos`;
    const { sink, texts } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_photos");
    expect(texts.some((t) => /saltar y subirlas después/i.test(t))).toBe(true);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_SKIP" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");
    expect(getWhatsAppChat(db, pubPsid)?.draft.photoUrls).toEqual([]);
  });

  it("asks about infográficos then photos, with optional description after", async () => {
    const pubPsid = `${PSID}-info-ask`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_infographic_ask");
    expect(texts.some((t) => /\*¿Tienes un infográfico del cuarto\?\*/.test(t))).toBe(true);
    expect(texts.some((t) => /_Las fotos reales del espacio/.test(t))).toBe(true);
    expect(texts.some((t) => /infográfico/i.test(t) && /plantilla|flyer/i.test(t))).toBe(true);
    expect(texts.some((t) => /siguiente paso/i.test(t))).toBe(true);
    expect(texts.some((t) => /Puedes subir hasta \d+ fotos/.test(t))).toBe(false);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_INFO_NO" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_photos");
    expect(texts.some((t) => /Puedes subir hasta 12 fotos/.test(t))).toBe(true);

    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_photos",
      draft: { ...chat.draft, photoUrls: ["/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-300000000001.jpg"] },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");
    expect(texts.some((t) => /descripción/i.test(t) && /opcional/i.test(t))).toBe(true);
  });

  it("caps infographics at 2 and keeps them out of the photo step bucket", async () => {
    const pubPsid = `${PSID}-info-cap`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_INFO_YES" }, sink);
    const urls: Record<string, string> = {
      m1: "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-100000000001.jpg",
      m2: "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-100000000002.jpg",
      m3: "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-100000000003.jpg",
    };
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      { imageMediaIds: ["m1", "m2", "m3"] },
      sink,
      { photoAckDelayMs: 0, saveImage: async (id) => urls[id] ?? null },
    );
    const chat = getWhatsAppChat(db, pubPsid);
    expect(chat?.draft.infographicUrls).toEqual([urls.m1, urls.m2]);
    // Still a separate bucket during the chat; they merge into the gallery only at publish.
    expect(chat?.draft.photoUrls).toEqual([]);
    expect(chat?.flow).toBe("pub_photos");
    expect(texts.some((t) => /leyendo el infográfico/i.test(t))).toBe(true);
    expect(texts.some((t) => /Puedes subir hasta 10 fotos/.test(t))).toBe(true);
  });

  it("publishes a single room from photos + pin + exact rent + legal tap", async () => {
    const photo = "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
    const info = "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff.jpg";
    const pubPsid = `${PSID}-pub`;
    const { sink, texts } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_photos",
      draft: { ...chat.draft, photoUrls: [photo], infographicUrls: [info] },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DESC_SKIP" }, sink);
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      {
        location: {
          lat: 20.6746,
          lng: -103.3665,
          name: `${"AvenidaChapultepecSinEspacios".repeat(4)}, Guadalajara, Jalisco, México`,
        },
      },
      sink,
    );
    expect(texts.some((t) => /renta mensual exacta/i.test(t))).toBe(true);
    expect(texts.some((t) => /Hasta \$5,000/.test(t))).toBe(false);
    await processWhatsAppUserInput(db, pubPsid, FROM, { text: "6500" }, sink);

    // Essentials the wizard asks for: room kind + size, roomies, deposit, tags.
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_room_kind");
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_KIND:private:large" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_roomies");
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_GENDER:female" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_deposit");
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DEP:rent" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_tags_add");
    await processWhatsAppUserInput(db, pubPsid, FROM, { text: "1,3,5" }, sink);
    expect(texts.some((t) => /\*¿Algo más\?\*/.test(t) && /Añadí:/.test(t))).toBe(true);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_TAGS_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_preview");

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUBLISH" }, sink);

    expect(texts.some((t) => t.includes("ya está público"))).toBe(true);
    const row = db
      .prepare(
        `SELECT p.contact_whatsapp, p.is_approximate_location, p.approximate_radius_m, p.title, p.neighborhood,
                p.summary, p.property_kind, r.rent_mxn, r.deposit_mxn, r.tags_json, r.roommate_gender_pref,
                r.room_dimension, r.lodging_type, r.image_urls_json, r.title AS room_title
         FROM properties p JOIN rooms r ON r.property_id = p.id
         WHERE r.image_urls_json LIKE '%aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg%' LIMIT 1`,
      )
      .get() as
      | {
          contact_whatsapp: string;
          is_approximate_location: number;
          approximate_radius_m: number;
          title: string;
          neighborhood: string;
          summary: string;
          property_kind: string;
          rent_mxn: number;
          deposit_mxn: number;
          tags_json: string;
          roommate_gender_pref: string;
          room_dimension: string;
          lodging_type: string;
          image_urls_json: string;
          room_title: string;
        }
      | undefined;
    expect(row?.contact_whatsapp).toBe("523318632070");
    expect(row?.is_approximate_location).toBe(1);
    expect(row?.approximate_radius_m).toBeGreaterThanOrEqual(100);
    expect(row?.rent_mxn).toBe(6500);
    expect(row?.deposit_mxn).toBe(6500);
    expect(JSON.parse(row?.tags_json ?? "[]")).toEqual(
      expect.arrayContaining(["wifi", "baño-privado", "mascotas"]),
    );
    expect(row?.roommate_gender_pref).toBe("female");
    expect(row?.room_dimension).toBe("large");
    expect(row?.lodging_type).toBe("private_room");
    expect(JSON.parse(row?.image_urls_json ?? "[]")).toEqual([photo, info]);
    expect(row?.title.length).toBeLessThanOrEqual(70);
    expect(row?.neighborhood.length).toBeLessThanOrEqual(50);
    expect(row?.summary).not.toMatch(/Publicado desde WhatsApp/i);
    // Description is written from the facts, so it names the room and the rent.
    expect(row?.summary).toMatch(/Privada grande/i);
    expect(row?.summary).toMatch(/6,500/);
    expect(row?.summary.length).toBeGreaterThanOrEqual(100);
    expect(row?.summary.length).toBeLessThanOrEqual(1500);
    expect(row?.property_kind).toBe("apartment");
    expect(row?.room_title).toBe("Recámara 1");
  });

  it("does not re-ask an essential the description already answered", async () => {
    const pubPsid = `${PSID}-essentials-known`;
    const { sink } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_rent",
      draft: {
        ...chat.draft,
        photoUrls: ["/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-200000000001.jpg"],
        locLat: 20.6746,
        locLng: -103.3665,
        locLabel: "Centro",
        roomKindSet: true,
        genderSet: true,
        depositMxn: 0,
      },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { text: "6000" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_tags_add");
  });

  it("confirm-first when the draft already has enough amenity tags", async () => {
    const pubPsid = `${PSID}-tags-confirm`;
    const { sink, texts } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_deposit",
      draft: {
        ...chat.draft,
        photoUrls: ["/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-200000000001.jpg"],
        locLat: 20.6746,
        locLng: -103.3665,
        locLabel: "Centro",
        rentMxn: 6000,
        roomKindSet: true,
        genderSet: true,
        depositMxn: 0,
        pubTags: ["wifi", "baño-privado", "mascotas"],
      },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DEP:0" }, sink);
    // Already at tags after deposit was set — trigger essentials by a no-op done path:
    // deposit already set, so send a dummy that continues… actually WA_DEP:0 with deposit already
    // set still runs continueToEssentials. Flow should be confirm.
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_tags");
    expect(texts.some((t) => /\*¿Confirmamos lo que incluye\?\*/.test(t))).toBe(true);
    expect(texts.some((t) => /1\. Wifi/.test(t))).toBe(false);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_TAGS_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_preview");
  });

  it("keeps a denied tag out of the published post", async () => {
    const pubPsid = `${PSID}-denied-tags`;
    const { sink } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      { text: "Rento recámara amueblada con wifi, no se aceptan mascotas, cerca del Centro." },
      sink,
    );
    const draft = getWhatsAppChat(db, pubPsid)!.draft;
    expect(draft.pubTags).toContain("muebles");
    expect(draft.pubTags).toContain("wifi");
    expect(draft.pubTags).not.toContain("mascotas");
    expect(draft.deniedTags).toContain("mascotas");
  });

  it("keeps every photo in a burst and then asks if more are pending", async () => {
    const pubPsid = `${PSID}-album`;
    const { sink, texts } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    const urls: Record<string, string> = {
      m1: "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.jpg",
      m2: "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000002.jpg",
      m3: "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000003.jpg",
    };
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      { imageMediaIds: ["m1", "m2", "m3"] },
      sink,
      {
        photoAckDelayMs: 0,
        saveImage: async (id) => urls[id] ?? null,
      },
    );
    const chat = getWhatsAppChat(db, pubPsid);
    expect(chat?.draft.photoUrls).toEqual([urls.m1, urls.m2, urls.m3]);
    expect(chat?.draft.infographicUrls).toEqual([]);
    expect(texts.some((t) => /\*¿Tienes más fotos pendientes\?\*/.test(t) && /Recibí 3/.test(t))).toBe(true);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_MORE" }, sink);
    expect(chat && getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_photos");
    expect(texts.some((t) => /\*¿Me mandas más fotos\?\*/.test(t))).toBe(true);
  });

  it("caps a 15-photo burst at 12 and tells the publisher extras were dropped", async () => {
    const pubPsid = `${PSID}-over-cap`;
    const { sink, texts } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    const ids = Array.from({ length: 15 }, (_, i) => `m${i + 1}`);
    const urls: Record<string, string> = Object.fromEntries(
      ids.map((id, i) => {
        const n = String(i + 1).padStart(12, "0");
        return [id, `/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-${n}.jpg`];
      }),
    );
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      { imageMediaIds: ids },
      sink,
      {
        photoAckDelayMs: 0,
        saveImage: async (id) => urls[id] ?? null,
      },
    );
    const chat = getWhatsAppChat(db, pubPsid);
    expect(chat?.draft.photoUrls).toHaveLength(12);
    expect(texts.some((t) => /Máximo 12 fotos/i.test(t) && /primeras 12/i.test(t) && /no incluí 3/i.test(t))).toBe(true);
    expect(texts.some((t) => /Ya tengo 12 fotos, el máximo/i.test(t))).toBe(true);
    expect(texts.some((t) => /Recibí 5/.test(t))).toBe(false);
  });

  it("does not drop photos when two album webhooks overlap", async () => {
    const pubPsid = `${PSID}-race`;
    const { sink } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    const saveImage = async (id: string) => {
      await new Promise((r) => setTimeout(r, 40));
      return `/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-00000000000${id}.jpg`;
    };
    await Promise.all([
      processWhatsAppUserInput(db, pubPsid, FROM, { imageMediaId: "1" }, sink, {
        photoAckDelayMs: 0,
        saveImage,
      }),
      processWhatsAppUserInput(db, pubPsid, FROM, { imageMediaId: "2" }, sink, {
        photoAckDelayMs: 0,
        saveImage,
      }),
    ]);
    const photos = getWhatsAppChat(db, pubPsid)?.draft.photoUrls ?? [];
    expect(photos).toHaveLength(2);
    expect(photos).toEqual(
      expect.arrayContaining([
        "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000001.jpg",
        "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-000000000002.jpg",
      ]),
    );
  });
});
