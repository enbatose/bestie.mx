import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { joinRowToPropertyListing, ROOM_PROPERTY_JOIN_SQL } from "./listingDto.js";

describe("Phase B schema (properties + rooms)", () => {
  it("seeds catalog with at least one multi-room property", () => {
    const dir = mkdtempSync(join(tmpdir(), "bestie-phaseb-"));
    const dbPath = join(dir, "test.db");
    let db: DatabaseSync | undefined;
    try {
      db = openDb(dbPath);
      const pc = (db.prepare("SELECT COUNT(*) AS c FROM properties").get() as { c: number }).c;
      const rc = (db.prepare("SELECT COUNT(*) AS c FROM rooms").get() as { c: number }).c;
      expect(pc).toBeGreaterThanOrEqual(11);
      expect(rc).toBeGreaterThanOrEqual(12);

      const duplex = db
        .prepare("SELECT COUNT(*) AS c FROM rooms WHERE property_id = ?")
        .get("prp__buc_duplex_demo") as { c: number };
      expect(duplex.c).toBe(2);

      const row = db
        .prepare(`${ROOM_PROPERTY_JOIN_SQL} WHERE r.id = ?`)
        .get("buc-demo-a") as Record<string, unknown>;
      const listing = joinRowToPropertyListing(row);
      expect(listing.propertyId).toBe("prp__buc_duplex_demo");
      expect(listing.id).toBe("buc-demo-a");
    } finally {
      db.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* Windows may keep WAL handles briefly */
      }
    }
  });
});
