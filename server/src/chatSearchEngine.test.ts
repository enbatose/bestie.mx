import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  chatSearchFollowups,
  chatSearchInventoryLine,
  runChatSearch,
  type ChatSearchQuery,
} from "./chatSearchEngine.js";
import { openDb } from "./db.js";

const CENTRO = { lat: 20.675138, lng: -103.347345 };

function baseQuery(over: Partial<ChatSearchQuery> = {}): ChatSearchQuery {
  return {
    q: "",
    poiName: "Centro",
    poiLat: CENTRO.lat,
    poiLng: CENTRO.lng,
    zoneLabel: "Centro",
    budgetMax: null,
    pref: null,
    tags: [],
    lodgingType: null,
    ...over,
  };
}

describe("chat search engine", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-chat-search-"));
    db = openDb(join(dir, "s.db"));
    const now = new Date().toISOString();
    const seed = (
      id: string,
      title: string,
      lat: number,
      lng: number,
      rent: number,
      pref: "any" | "female" | "male",
    ) => {
      db.prepare(
        `INSERT INTO properties (
          id, publisher_id, status, post_mode, title, city, neighborhood,
          lat, lng, summary, contact_whatsapp, show_whatsapp, image_urls_json, created_at, published_at
        ) VALUES (?, 'pub-seed', 'published', 'room', ?, 'Guadalajara', 'Centro', ?, ?,
          'Resumen del espacio de prueba para la búsqueda en chat.', '523312345678', 1, '[]', ?, ?)`,
      ).run(`prp__${id}`, title, lat, lng, now, now);
      db.prepare(
        `INSERT INTO rooms (
          id, property_id, status, title, rent_mxn, rooms_available, tags_json,
          roommate_gender_pref, age_min, age_max, summary
        ) VALUES (?, ?, 'published', 'Recámara 1', ?, 1, '[]', ?, 18, 45, 'Resumen recámara de prueba.')`,
      ).run(`room-${id}`, `prp__${id}`, rent, pref);
    };
    // In the 3.5 km disk, inside and above a 7k budget.
    seed("centro-cheap", "Cuarto Centro barato", CENTRO.lat, CENTRO.lng, 6000, "any");
    seed("centro-pricey", "Cuarto Centro caro", CENTRO.lat + 0.002, CENTRO.lng, 11000, "any");
    // ~5 km out: nearby, not exact.
    seed("out-of-zone", "Cuarto a 5 km", CENTRO.lat + 0.045, CENTRO.lng, 6100, "any");
    // Women-only, so a male seeker must never see it in either bucket.
    seed("female-only", "Cuarto solo mujeres", CENTRO.lat, CENTRO.lng + 0.001, 6300, "female");
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("puts in-zone matches in exact and the rest in nearby", () => {
    const out = runChatSearch(db, baseQuery({ budgetMax: 7000 }));
    const exact = out.exact.map((l) => l.title);
    const nearby = out.nearby.map((l) => l.title);
    expect(exact).toContain("Cuarto Centro barato");
    expect(exact).not.toContain("Cuarto Centro caro");
    // Over budget in the zone, and in budget but farther out, are both "hay más".
    expect(nearby).toContain("Cuarto Centro caro");
    expect(nearby).toContain("Cuarto a 5 km");
    expect(out.cityTotal).toBeGreaterThanOrEqual(out.exact.length + out.nearby.length);
  });

  it("keeps gender preference out of the nearby bucket too", () => {
    const out = runChatSearch(db, baseQuery({ pref: "male" }));
    const all = [...out.exact, ...out.nearby].map((l) => l.title);
    expect(all).not.toContain("Cuarto solo mujeres");
  });

  it("sorts exact matches by distance then rent", () => {
    const out = runChatSearch(db, baseQuery());
    expect(out.exact[0]?.title).toBe("Cuarto Centro barato");
  });

  it("names the zone, the nearby count, and the city total", () => {
    const line = chatSearchInventoryLine(runChatSearch(db, baseQuery({ budgetMax: 7000 })));
    expect(line).toMatch(/en Centro/);
    expect(line).toMatch(/más cerca/);
    expect(line).toMatch(/en todo Guadalajara/);
  });

  it("offers the nearby bucket first and fits WhatsApp's three buttons", () => {
    const query = baseQuery({ budgetMax: 7000 });
    const followups = chatSearchFollowups(runChatSearch(db, query), query, {
      nearby: "WA_NEARBY",
      budget: "WA_BUDGET",
      zone: "WA_SEARCH",
      menu: "WA_MENU",
    });
    expect(followups).toHaveLength(3);
    expect(followups[0]?.payload).toBe("WA_NEARBY");
    expect(followups.every((f) => f.title.length <= 20)).toBe(true);
  });

  it("falls back to the whole city when the seeker gave no zone", () => {
    const out = runChatSearch(db, baseQuery({ poiName: null, poiLat: null, poiLng: null, zoneLabel: null }));
    expect(out.zoneLabel).toBe("Guadalajara");
    expect(out.exact).toHaveLength(out.cityTotal);
    expect(out.nearby).toHaveLength(0);
  });
});
