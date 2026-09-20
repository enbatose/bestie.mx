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

function capturingSink(): { sink: ChatSink; texts: string[]; ctas: Array<{ body: string; url: string }> } {
  const texts: string[] = [];
  const ctas: Array<{ body: string; url: string }> = [];
  return {
    texts,
    ctas,
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
      sendCtaUrl: async (opts) => {
        ctas.push({ body: opts.body, url: opts.url });
        texts.push(opts.body);
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

  it("states exact+related total and ZMG broaden inventory after results", async () => {
    const { sink, texts, ctas } = capturingSink();
    const psid = `${PSID}-inventory`;
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_SEARCH" }, sink);
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_POI:centro" }, sink);
    expect(ctas.some((c) => /cuartos? en total en bestie\.mx/.test(c.body) && /\/busquedas\//.test(c.url))).toBe(
      true,
    );
    expect(texts.some((t) => /\*ZMG\*/.test(t) && /Zona Metropolitana de Guadalajara/.test(t))).toBe(true);
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
    expect(s?.draft.q.toLowerCase()).toContain("centro");
    expect(texts.some((t) => t.includes("Cuarto Centro"))).toBe(true);
  });

  it("asks for free-form search text when Buscar starts", async () => {
    const { sink, texts } = capturingSink();
    const psid = `${PSID}-prompt`;
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_SEARCH" }, sink);
    expect(getWhatsAppChat(db, psid)?.flow).toBe("search_query");
    expect(texts.some((t) => /Qué estás buscando/.test(t))).toBe(true);
  });

  async function skipToPhotos(psid: string, sink: ReturnType<typeof capturingSink>["sink"]) {
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_DESC_SKIP" }, sink);
    await processWhatsAppUserInput(db, psid, FROM, { quickReplyPayload: "WA_INFO_NO" }, sink);
  }

  it("lets you skip photos and go to preview with defaults", async () => {
    const pubPsid = `${PSID}-skip-photos`;
    const { sink, texts } = capturingSink();
    await skipToPhotos(pubPsid, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_photos");
    expect(texts.some((t) => /saltar y subirlas después/i.test(t))).toBe(true);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_SKIP" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_preview");
    expect(getWhatsAppChat(db, pubPsid)?.draft.photoUrls).toEqual([]);
    expect(texts.some((t) => /Así se vería tu anuncio/i.test(t))).toBe(true);
  });

  it("starts with Facebook paste, then optional media, then preview", async () => {
    const pubPsid = `${PSID}-info-ask`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");
    expect(texts.some((t) => /\*¿Cómo describes el cuarto\?\*/.test(t))).toBe(true);

    const part1 = "Rento recámara amueblada con wifi y baño privado cerca del Centro. ";
    const part2 = "$6500 al mes. Se aceptan mascotas. Ideal para profesionistas.";
    await processWhatsAppUserInput(db, pubPsid, FROM, { text: part1 }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");
    expect(getWhatsAppChat(db, pubPsid)?.draft.sourceText).toContain("Rento recámara");
    expect(texts.some((t) => /\*¿Hay más descripción\?\*/.test(t))).toBe(true);
    expect(texts.some((t) => /Recibí tu texto/.test(t))).toBe(true);

    await processWhatsAppUserInput(db, pubPsid, FROM, { text: part2 }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.draft.sourceText).toContain("$6500");
    expect(getWhatsAppChat(db, pubPsid)?.draft.sourceText).toContain("Rento recámara");
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DESC_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_infographic_ask");
    expect(texts.some((t) => /Estoy leyendo todo el texto/i.test(t))).toBe(true);
    expect(texts.some((t) => /\*¿Tienes un flyer o imagen con los datos del cuarto\?\*/.test(t))).toBe(true);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_INFO_NO" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_photos");
    expect(texts.some((t) => /Puedes subir hasta 12 fotos/.test(t))).toBe(true);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_SKIP" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_preview");
    expect(texts.some((t) => /renta mensual exacta/i.test(t))).toBe(false);
    expect(texts.some((t) => /\*¿Qué incluye el cuarto\?\*/.test(t))).toBe(false);
  });

  it("caps infographics at 2 and keeps them out of the photo step bucket", async () => {
    const pubPsid = `${PSID}-info-cap`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DESC_SKIP" }, sink);
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
    expect(chat?.draft.photoUrls).toEqual([]);
    expect(chat?.flow).toBe("pub_photos");
    expect(texts.some((t) => /leyendo el infográfico/i.test(t))).toBe(true);
    expect(texts.some((t) => /Puedes subir hasta 10 fotos/.test(t))).toBe(true);
  });

  it("publishes from pasted text + media without rent/location interview", async () => {
    const photo = "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
    const info = "/api/uploads/aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff.jpg";
    const pubPsid = `${PSID}-pub`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      {
        text:
          "Rento recámara privada grande amueblada con wifi y baño privado en Chapultepec. $6500 mensuales, depósito un mes. Prefiero roomie mujer. Se aceptan mascotas.",
      },
      sink,
    );
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_desc");
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DESC_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_infographic_ask");
    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_photos",
      draft: {
        ...chat.draft,
        photoUrls: [photo],
        infographicUrls: [info],
        rentMxn: 6500,
        locLat: 20.6746,
        locLng: -103.3665,
        locLabel: "Chapultepec",
        neighborhood: "Chapultepec",
        depositMxn: 6500,
        lodging: "private_room",
        roomDimension: "large",
        roomKindSet: true,
        genderPref: "female",
        genderSet: true,
        pubTags: ["wifi", "baño-privado", "mascotas", "muebles"],
        summary:
          "Recámara privada grande amueblada en Chapultepec con wifi y baño privado. Renta $6,500 al mes. Ideal para quien busca un espacio cómodo cerca de la zona.",
      },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_DONE" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_preview");
    expect(texts.some((t) => /Cambiar etiquetas/.test(t))).toBe(false);
    expect(texts.some((t) => /renta mensual exacta/i.test(t))).toBe(false);

    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUBLISH" }, sink);

    expect(texts.some((t) => t.includes("ya está público"))).toBe(true);
    expect(texts.some((t) => /\*¿Qué quieres hacer en Guadalajara\?\*/.test(t))).toBe(false);
    expect(texts.some((t) => /escribe Hola/i.test(t))).toBe(true);
    const row = db
      .prepare(
        `SELECT p.contact_whatsapp, p.is_approximate_location, p.approximate_radius_m, p.hide_pricing, p.title, p.neighborhood,
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
          hide_pricing: number;
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
    expect(row?.hide_pricing).toBe(0);
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
    expect(row?.summary.length).toBeGreaterThanOrEqual(100);
    expect(row?.summary.length).toBeLessThanOrEqual(1500);
    expect(row?.property_kind).toBe("apartment");
    expect(row?.room_title).toBe("Recámara 1");
  });

  it("publishes with hidden rent and city pin when the paste has no price or zone", async () => {
    const pubPsid = `${PSID}-defaults`;
    const { sink, texts } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DESC_SKIP" }, sink);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_INFO_NO" }, sink);
    const chat = getWhatsAppChat(db, pubPsid)!;
    upsertWhatsAppChat(db, pubPsid, {
      flow: "pub_photos",
      draft: {
        ...chat.draft,
        sourceText: "Cuarto disponible, bonito y limpio, escribe para más info.",
        summary:
          "Cuarto disponible en Guadalajara, bonito y limpio. Escribe para más información sobre el espacio y la convivencia.",
      },
    });
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PHOTOS_SKIP" }, sink);
    expect(getWhatsAppChat(db, pubPsid)?.flow).toBe("pub_preview");
    expect(texts.some((t) => /Renta oculta/i.test(t))).toBe(true);
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUBLISH" }, sink);
    expect(texts.some((t) => t.includes("ya está público"))).toBe(true);
    const row = db
      .prepare(
        `SELECT p.hide_pricing, p.lat, p.lng, r.rent_mxn FROM properties p
         JOIN rooms r ON r.property_id = p.id
         WHERE r.summary LIKE '%bonito y limpio%'
         ORDER BY p.created_at DESC LIMIT 1`,
      )
      .get() as { hide_pricing: number; lat: number; lng: number; rent_mxn: number } | undefined;
    expect(row?.hide_pricing).toBe(1);
    expect(row?.rent_mxn).toBe(0);
    expect(row?.lat).toBeCloseTo(20.675138, 4);
    expect(row?.lng).toBeCloseTo(-103.347345, 4);
  });

  it("keeps a denied tag out of the published post", async () => {
    const pubPsid = `${PSID}-denied-tags`;
    const { sink } = capturingSink();
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_PUB" }, sink);
    await processWhatsAppUserInput(
      db,
      pubPsid,
      FROM,
      { text: "Rento recámara amueblada con wifi, no se aceptan mascotas, cerca del Centro." },
      sink,
    );
    await processWhatsAppUserInput(db, pubPsid, FROM, { quickReplyPayload: "WA_DESC_DONE" }, sink);
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
    expect(texts.some((t) => /Máximo 12 fotos/i.test(t) && /primeras 12/i.test(t) && /de más no entraron/i.test(t))).toBe(true);
    expect(texts.some((t) => /Listo: ya tengo el máximo de 12 fotos/i.test(t))).toBe(true);
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
