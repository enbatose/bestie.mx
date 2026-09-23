import type { DatabaseSync } from "node:sqlite";
import {
  isFacebookOAuthPasswordHash,
  isGoogleOAuthPasswordHash,
  isWaOnlyPasswordHash,
} from "./adminAuth.js";

/** How the Bestie account was first created. Set once; never overwritten on later link/login. */
export const REGISTRATION_SOURCES = ["whatsapp", "facebook", "google", "email", "phone"] as const;
export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

export const REGISTRATION_SOURCE_LABELS: Record<RegistrationSource, string> = {
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  google: "Google",
  email: "Email",
  phone: "Celular",
};

export function isRegistrationSource(raw: unknown): raw is RegistrationSource {
  return typeof raw === "string" && (REGISTRATION_SOURCES as readonly string[]).includes(raw);
}

export function inferRegistrationSourceFromRow(row: {
  password_hash?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  display_name?: string | null;
}): RegistrationSource {
  const hash = String(row.password_hash ?? "");
  if (isWaOnlyPasswordHash(hash)) return "whatsapp";
  if (isGoogleOAuthPasswordHash(hash)) return "google";
  if (isFacebookOAuthPasswordHash(hash)) return "facebook";
  const phone = String(row.phone_e164 ?? "").trim();
  const email = String(row.email ?? "").trim();
  if (phone && !email) return "phone";
  return "email";
}

export function ensureRegistrationSourceSchema(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "registration_source")) {
    db.exec(`ALTER TABLE users ADD COLUMN registration_source TEXT`);
  }
  if (!cols.some((c) => c.name === "wa_name_ask_skip_until")) {
    db.exec(`ALTER TABLE users ADD COLUMN wa_name_ask_skip_until TEXT`);
  }

  const pending = db
    .prepare(
      `SELECT id, password_hash, phone_e164, email, display_name
       FROM users
       WHERE registration_source IS NULL OR trim(IFNULL(registration_source, '')) = ''`,
    )
    .all() as Array<{
    id: string;
    password_hash: string | null;
    phone_e164: string | null;
    email: string | null;
    display_name: string | null;
  }>;

  const upd = db.prepare(`UPDATE users SET registration_source = ? WHERE id = ?`);
  for (const row of pending) {
    upd.run(inferRegistrationSourceFromRow(row), row.id);
  }
}

/** Insert helper: only write source when creating a user. */
export function registrationSourceSqlValue(source: RegistrationSource): string {
  return source;
}
