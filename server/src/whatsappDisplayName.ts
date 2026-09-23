import type { DatabaseSync } from "node:sqlite";

export const WHATSAPP_PLACEHOLDER_DISPLAY_NAME = "Usuario WhatsApp";

export function isWhatsAppPlaceholderDisplayName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return true;
  return (
    n === WHATSAPP_PLACEHOLDER_DISPLAY_NAME.toLowerCase() ||
    n === "usuario whatsapp" ||
    n === "usuario de whatsapp"
  );
}

export function firstNameFromDisplayName(name: string | null | undefined): string | null {
  const t = (name ?? "").trim();
  if (!t || isWhatsAppPlaceholderDisplayName(t)) return null;
  const first = t.split(/\s+/)[0]?.trim() ?? "";
  return first || null;
}

/** Normalize a WhatsApp-typed name; null if skip / invalid. */
export function parseWhatsAppProvidedName(raw: string): string | null {
  const t = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "")
    .trim()
    .slice(0, 60);
  if (!t) return null;
  if (/^(saltar|skip|no|luego|después|despues|omitir|pasar)[\s!.]*$/i.test(t)) return null;
  if (isWhatsAppPlaceholderDisplayName(t)) return null;
  if (t.length < 2) return null;
  return t;
}

export function getUserDisplayName(db: DatabaseSync, userId: string): string | null {
  const row = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(userId) as
    | { display_name: string | null }
    | undefined;
  return row?.display_name?.trim() || null;
}

export function userNeedsWhatsAppNamePrompt(db: DatabaseSync, userId: string): boolean {
  const row = db
    .prepare(`SELECT display_name, wa_name_ask_skip_until FROM users WHERE id = ?`)
    .get(userId) as { display_name: string | null; wa_name_ask_skip_until: string | null } | undefined;
  if (!row) return false;
  if (!isWhatsAppPlaceholderDisplayName(row.display_name)) return false;
  const until = row.wa_name_ask_skip_until?.trim();
  if (until) {
    const ms = Date.parse(until);
    if (Number.isFinite(ms) && ms > Date.now()) return false;
  }
  return true;
}

export function setUserDisplayNameFromWhatsApp(db: DatabaseSync, userId: string, displayName: string): void {
  db.prepare(
    `UPDATE users SET display_name = ?, wa_name_ask_skip_until = NULL WHERE id = ?`,
  ).run(displayName.slice(0, 120), userId);
}

/** Skip name for ~24h (same conversation window); ask again on a later session. */
export function deferWhatsAppNamePrompt(db: DatabaseSync, userId: string, hours = 24): void {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  db.prepare(`UPDATE users SET wa_name_ask_skip_until = ? WHERE id = ?`).run(until, userId);
}
