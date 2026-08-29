import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { roomReferenceCode } from "./listingReference.js";
import { resolveListingShareOg } from "./listingShareOg.js";
import { resolveShareOgSourceFilename } from "./shareOgImage.js";

const COVER = "/api/uploads/claim-cover-photo.jpg";

describe("claim-link listing share OG", () => {
  let dir: string;
  let db: DatabaseSync;
  const token = "claimogtoken1234567890abcdef12";
  const expiredToken = "expiredclaimtoken1234567890ab";
  const propertyId = "prp__bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
  const roomId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-claim-og-"));
    db = openDb(join(dir, "t.db"));
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO properties (
        id, publisher_id, status, post_mode, title, city, neighborhood,
        lat, lng, summary, contact_whatsapp, property_kind,
        bedrooms_total, bathrooms, show_whatsapp, image_urls_json,
        is_approximate_location, approximate_radius_m,
        created_at, assisted_draft, created_by_admin_id
      ) VALUES (
        ?, ?, 'draft', 'room', 'Cuarto claim OG', 'Guadalajara', 'Atlas',
        20.67, -103.35, 'Recámara con baño propio cerca del parque y transporte.', '523316979814', 'house',
        1, 1, 1, ?,
        1, 200,
        ?, 1, 'admin-claim-og'
      )
    `).run(propertyId, "orphan-pub-claim-og", JSON.stringify([COVER]), now);
    db.prepare(`
      INSERT INTO rooms (
        id, property_id, status, title, rent_mxn, rooms_available, tags_json,
        roommate_gender_pref, age_min, age_max, summary, lodging_type,
        available_from, minimal_stay_months, room_dimension,
        aval_required, sublet_allowed, sort_order, deposit_mxn,
        image_urls_json, created_at, updated_at
      ) VALUES (
        ?, ?, 'draft', '', 5500, 1, '[]',
        'any', 18, 99, 'Recámara con baño propio cerca del parque y transporte.', 'private_room',
        ?, 1, 'medium',
        0, 0, 0, 0,
        ?, ?, ?
      )
    `).run(roomId, propertyId, now.slice(0, 10), JSON.stringify([COVER]), now, now);
    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, propertyId, "admin-claim-og", "orphan-pub-claim-og", Date.now() + 86_400_000, Date.now());
    db.prepare(`
      INSERT INTO assisted_draft_claim_tokens (
        token, property_id, created_by_admin_id, orphan_publisher_id,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(expiredToken, propertyId, "admin-claim-og", "orphan-pub-claim-og", Date.now() - 1_000, Date.now() - 2_000);
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("resolves branded room OG only when the claim token is live", () => {
    const ref = roomReferenceCode(roomId);
    const base = "https://dev.bestie.mx";
    expect(resolveListingShareOg(db, `/anuncio/${ref}`, base)).toBeNull();
    expect(resolveListingShareOg(db, `/anuncio/${ref}`, base, { claim: expiredToken })).toBeNull();

    const meta = resolveListingShareOg(db, `/anuncio/${ref}`, base, { claim: token });
    expect(meta).not.toBeNull();
    expect(meta!.title).toContain("Cuarto claim OG");
    expect(meta!.description).toContain("5,500");
    expect(meta!.imageUrl).toBe(`${base}/api/share-og/anuncio/${ref}.jpg`);
    expect(meta!.url).toBe(`${base}/anuncio/${ref}?claim=${token}`);
    expect(meta!.noIndex).toBe(true);
    expect(meta!.jsonLd).toBeUndefined();
    expect(JSON.stringify(meta)).not.toContain("3316979814");

    const fromBorrador = resolveListingShareOg(db, `/borrador/${token}`, base);
    expect(fromBorrador?.imageUrl).toBe(meta!.imageUrl);
    expect(fromBorrador?.title).toBe(meta!.title);
  });

  it("serves share-og cover for unpublished rooms with a live claim token", () => {
    const ref = roomReferenceCode(roomId);
    expect(resolveShareOgSourceFilename(db, { kind: "anuncio", refParam: `${ref}.jpg` })).toBe(
      "claim-cover-photo.jpg",
    );
  });
});
