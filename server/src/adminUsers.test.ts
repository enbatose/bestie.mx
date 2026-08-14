import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { ensureMessagingSchema, FEEDBACK_BOT_USER_ID, SUPPORT_BOT_USER_ID } from "./messagingSchema.js";
import { classifyAdminUserRole, listAdminUsers } from "./adminUsers.js";

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      email_canonical TEXT,
      phone_e164 TEXT,
      password_hash TEXT,
      display_name TEXT,
      created_at TEXT,
      email_verified_at TEXT
    );
  `);
  ensureMessagingSchema(db);
  return db;
}

function insertUser(
  db: DatabaseSync,
  row: {
    id: string;
    email: string | null;
    displayName: string;
    verified: boolean;
    createdAt?: string;
  },
): void {
  db.prepare(
    `INSERT INTO users (id, email, phone_e164, display_name, created_at, email_verified_at)
     VALUES (?, ?, NULL, ?, ?, ?)`,
  ).run(
    row.id,
    row.email,
    row.displayName,
    row.createdAt ?? "2026-08-01T00:00:00.000Z",
    row.verified ? "2026-08-01T01:00:00.000Z" : null,
  );
}

describe("admin user segments", () => {
  const prevAdmin = process.env.ADMIN_EMAILS;

  it("classifies system bots and admin emails", () => {
    process.env.ADMIN_EMAILS = "ops@test.mx";
    expect(classifyAdminUserRole(SUPPORT_BOT_USER_ID, "soporte-sistema@bestie.mx")).toBe("system");
    expect(classifyAdminUserRole(FEEDBACK_BOT_USER_ID, "feedback-sistema@bestie.mx")).toBe("system");
    expect(classifyAdminUserRole("u-admin", "ops@test.mx")).toBe("admin");
    expect(classifyAdminUserRole("u-real", "ana@test.mx")).toBe("user");
    process.env.ADMIN_EMAILS = prevAdmin;
  });

  it("splits real, pending, staff, and all (excluding admin/system from all)", () => {
    process.env.ADMIN_EMAILS = "ops@test.mx";
    const db = setupDb();
    insertUser(db, { id: "u-real", email: "ana@test.mx", displayName: "Ana", verified: true });
    insertUser(db, {
      id: "u-pending",
      email: "pedro@test.mx",
      displayName: "Pedro",
      verified: false,
      createdAt: "2026-08-02T00:00:00.000Z",
    });
    insertUser(db, { id: "u-admin", email: "ops@test.mx", displayName: "Ops", verified: false });
    insertUser(db, { id: "u-phone", email: null, displayName: "WA only", verified: false });

    const real = listAdminUsers(db, { segment: "real", limit: 50 });
    expect(real.users.map((u) => u.id).sort()).toEqual(["u-phone", "u-real"].sort());
    expect(real.counts.real).toBe(2);

    const pending = listAdminUsers(db, { segment: "pending" });
    expect(pending.users.map((u) => u.id)).toEqual(["u-pending"]);
    expect(pending.users[0]?.accountStatus).toBe("pending_validation");

    const staff = listAdminUsers(db, { segment: "staff" });
    const staffIds = staff.users.map((u) => u.id);
    expect(staffIds).toContain("u-admin");
    expect(staffIds).toContain(SUPPORT_BOT_USER_ID);
    expect(staffIds).toContain(FEEDBACK_BOT_USER_ID);
    expect(staff.users.find((u) => u.id === "u-admin")?.role).toBe("admin");
    expect(staff.users.find((u) => u.id === SUPPORT_BOT_USER_ID)?.role).toBe("system");

    const all = listAdminUsers(db, { segment: "all" });
    expect(all.users.map((u) => u.id).sort()).toEqual(["u-pending", "u-phone", "u-real"].sort());
    expect(all.counts.all).toBe(3);
    expect(all.users.some((u) => u.id === "u-admin")).toBe(false);
    expect(all.users.some((u) => u.id === SUPPORT_BOT_USER_ID)).toBe(false);

    process.env.ADMIN_EMAILS = prevAdmin;
  });
});
