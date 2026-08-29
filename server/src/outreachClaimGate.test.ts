import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { evaluateOutreachClaimGate } from "./phoneAuth.js";

describe("evaluateOutreachClaimGate", () => {
  let dir: string;
  let db: DatabaseSync;
  let matchId: string;
  let otherId: string;
  let bareId: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "bestie-claim-gate-"));
    db = openDb(join(dir, "t.db"));
    matchId = randomUUID();
    otherId = randomUUID();
    bareId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, phone_verified_at)
       VALUES (?, ?, ?, ?, 'x', 'Match', ?, ?, ?)`,
    ).run(matchId, "match@test.mx", "match@test.mx", "+523331112233", now, now, now);
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at, phone_verified_at)
       VALUES (?, ?, ?, ?, 'x', 'Other', ?, ?, ?)`,
    ).run(otherId, "other@test.mx", "other@test.mx", "+523339998877", now, now, now);
    db.prepare(
      `INSERT INTO users (id, email, email_canonical, phone_e164, password_hash, display_name, created_at, email_verified_at)
       VALUES (?, ?, ?, NULL, 'x', 'Bare', ?, ?)`,
    ).run(bareId, "bare@test.mx", "bare@test.mx", now, now);
  });

  afterAll(() => {
    db.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows */
    }
  });

  it("skips OTP when the listing MX number matches the verified profile", () => {
    const g = evaluateOutreachClaimGate(db, matchId, "523331112233");
    expect(g).toMatchObject({ ok: true, skipOtp: true });
  });

  it("refuses a different verified profile phone and points to admin or profile change", () => {
    const g = evaluateOutreachClaimGate(db, otherId, "523330001111");
    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.error).toBe("phone_mismatch");
    expect(g.status).toBe(403);
    expect(g.message).toMatch(/admin/i);
    expect(g.message).toMatch(/perfil/i);
  });

  it("does not send a path when the listing number is already verified on another account", () => {
    const g = evaluateOutreachClaimGate(db, bareId, "523331112233");
    expect(g.ok).toBe(false);
    if (g.ok) return;
    expect(g.error).toBe("phone_taken");
    expect(g.status).toBe(409);
  });

  it("skips OTP for non-MX listing phones", () => {
    const g = evaluateOutreachClaimGate(db, otherId, "19175551234");
    expect(g).toMatchObject({ ok: true, skipOtp: true, hasDraftPhone: true });
  });

  it("skips OTP when there is no real draft phone", () => {
    const g = evaluateOutreachClaimGate(db, otherId, "0000000000000");
    expect(g).toMatchObject({ ok: true, skipOtp: true, hasDraftPhone: false });
  });

  it("lets admins skip OTP", () => {
    const g = evaluateOutreachClaimGate(db, otherId, "523331112233", { isAdmin: true });
    expect(g).toMatchObject({ ok: true, skipOtp: true });
  });
});
