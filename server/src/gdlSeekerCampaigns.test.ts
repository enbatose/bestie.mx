import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { GDL_SEEKER_CAMPAIGNS, ensureGdlSeekerCampaignShares } from "./gdlSeekerCampaigns.js";
import { resolveSharedSearchOg } from "./sharedSearchOg.js";
import { loadSharedSearch } from "./sharedSearches.js";

describe("GDL seeker campaign shares", () => {
  let dir: string;
  let db: DatabaseSync;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-gdl-campaign-"));
    db = openDb(join(dir, "t.db"));
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        created_at, published_at
      ) VALUES (?, 'pub-c', 'published', 'room', 'Cuarto Chapu', 'Guadalajara', 'Americana',
        20.6746, -103.3665, '', '523331112233', 'apartment',
        1, 1, 1, '[]', ?, ?)`,
    ).run("prp_camp_chapu", now, now);
    db.prepare(
      `INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary, lodging_type,
        available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn,
        image_urls_json, created_at, updated_at
      ) VALUES (
        'room_camp_chapu', 'prp_camp_chapu', 'published', 'Cuarto Chapu', 7000, 1, '[]',
        'any', 18, 99, '', 'private_room',
        ?, 1, 'medium', 0, 0, 0, 0, '[]', ?, ?
      )`,
    ).run(now.slice(0, 10), now, now);
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("seeds stable slugs for the three Meta ads", () => {
    for (const c of GDL_SEEKER_CAMPAIGNS) {
      const row = loadSharedSearch(db, c.id);
      expect(row?.kind).toBe("campaign");
      expect(row?.id).toBe(c.id);
    }
  });

  it("keeps the same slug after a second boot", () => {
    const before = loadSharedSearch(db, "gdlchapu")!;
    ensureGdlSeekerCampaignShares(db);
    expect(loadSharedSearch(db, "gdlchapu")?.id).toBe(before.id);
  });

  it("puts live exact counts and a POI image on the Chapu OG tags", () => {
    const og = resolveSharedSearchOg(db, "/busquedas/gdlchapu", "https://www.bestie.mx");
    expect(og?.title).toMatch(/^Bestie: \d+ cuartos en Zona Chapultepec\/Americana$/);
    expect(og?.description).toMatch(/Time Out/);
    expect(og?.imageUrl).toBe("https://www.bestie.mx/brand/og-busquedas/gdlchapu.jpg");
    expect(og?.url).toBe("https://www.bestie.mx/busquedas/gdlchapu");
  });
});
