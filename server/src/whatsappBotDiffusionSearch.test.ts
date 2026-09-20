import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatSink } from "./chatChannel.js";
import { openDb } from "./db.js";
import {
  cardsForDiffusionListings,
  countZmgSearchCards,
  fallbackExtractionFromSearchText,
  runWhatsAppDiffusionSearchAndReply,
} from "./whatsappBotDiffusionSearch.js";

function capturingSink(): {
  sink: ChatSink;
  texts: string[];
  ctas: Array<{ body: string; buttonText: string; url: string }>;
  cardCounts: number[];
} {
  const texts: string[] = [];
  const ctas: Array<{ body: string; buttonText: string; url: string }> = [];
  const cardCounts: number[] = [];
  return {
    texts,
    ctas,
    cardCounts,
    sink: {
      sendText: async (t) => {
        texts.push(t);
      },
      sendQuickReplies: async (t) => {
        texts.push(t);
      },
      sendListingCards: async (cards, footer) => {
        cardCounts.push(cards.length);
        texts.push(cards.map((c) => c.title).join(" | "));
        if (footer.trim()) texts.push(footer);
      },
      sendCtaUrl: async (opts) => {
        ctas.push(opts);
        texts.push(opts.body);
      },
      sendImage: async ({ caption }) => {
        if (caption) texts.push(caption);
      },
    },
  };
}

describe("WhatsApp Difusión search", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-wa-diff-"));
    db = openDb(join(dir, "d.db"));
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json, created_at, published_at
      ) VALUES (?, ?, 'published', 'room', 'Cuarto Centro Histórico', 'Guadalajara', 'Centro',
        20.6751, -103.3473, 'Resumen del espacio en el centro.', '523312345678', 1, '[]', ?, ?)`,
    ).run("prp__wa-diff-centro", "pub-wa-diff", now, now);
    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary
      ) VALUES (?, ?, 'published', 'Recámara 1', 6200, 1, '[]', 'any', 18, 45, 'Resumen recámara centro.')`,
    ).run("wa-diff-room-01", "prp__wa-diff-centro");
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("builds a Centro fallback extraction without Gemini", () => {
    const ex = fallbackExtractionFromSearchText("Busco cuarto cerca de Centro hasta 8000");
    expect(ex.pois?.[0]).toBe("Centro");
    expect(ex.budgetMax).toBe(8000);
  });

  it("counts ZMG search cards", () => {
    expect(countZmgSearchCards(db)).toBeGreaterThanOrEqual(1);
  });

  it("replies with up to 10 cards, match total CTA, and bold ZMG broaden line", async () => {
    const { sink, texts, ctas, cardCounts } = capturingSink();
    const result = await runWhatsAppDiffusionSearchAndReply(db, sink, {
      text: "Busco cuarto cerca de Centro",
      createdByUserId: "user-wa-diff",
    });
    expect(result.matchTotal).toBeGreaterThanOrEqual(1);
    expect(result.sharePath).toMatch(/^\/busquedas\//);
    expect(cardCounts[0]).toBeGreaterThanOrEqual(1);
    expect(cardCounts[0]).toBeLessThanOrEqual(10);
    expect(texts.some((t) => t.includes("Cuarto Centro"))).toBe(true);
    expect(ctas[0]?.buttonText).toBe("Ver búsqueda");
    expect(ctas[0]?.url).toContain(result.sharePath);
    expect(ctas[0]?.body).toMatch(/\*\d+\*/);
    expect(texts.some((t) => /\*\d+\*.*Zona Metropolitana de Guadalajara \(\*ZMG\*\)/.test(t))).toBe(
      true,
    );
  });

  it("caps listing cards at 10", () => {
    const fake = Array.from({ length: 15 }, (_, i) => ({
      id: `room-${i}`,
      title: `Cuarto ${i}`,
      neighborhood: "Centro",
      city: "Guadalajara",
      rentMxn: 5000,
      hidePricing: false,
      propertyPostMode: "room" as const,
      roomImageUrls: [] as string[],
      propertyImageUrls: [] as string[],
    }));
    expect(cardsForDiffusionListings(fake as never, 10)).toHaveLength(10);
  });
});
