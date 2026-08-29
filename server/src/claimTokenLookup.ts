import type { DatabaseSync } from "node:sqlite";

/** Live (unexpired) claim token → property, or null. */
export function lookupLiveClaimToken(
  db: DatabaseSync,
  token: string,
): { propertyId: string; token: string } | null {
  const t = token.trim();
  if (!t) return null;
  const row = db
    .prepare(`SELECT property_id, expires_at FROM assisted_draft_claim_tokens WHERE token = ?`)
    .get(t) as { property_id: string; expires_at: number } | undefined;
  if (!row || Date.now() > Number(row.expires_at)) return null;
  return { propertyId: String(row.property_id), token: t };
}

/** True when this property has at least one unexpired claim token (draft outreach). */
export function propertyHasUnexpiredClaimToken(db: DatabaseSync, propertyId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM assisted_draft_claim_tokens WHERE property_id = ? AND expires_at >= ? LIMIT 1`,
    )
    .get(propertyId, Date.now()) as { ok?: number } | undefined;
  return Boolean(row?.ok);
}

export function readClaimQueryParam(query: unknown): string {
  if (!query || typeof query !== "object") return "";
  const c = (query as { claim?: unknown }).claim;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c) && typeof c[0] === "string") return c[0].trim();
  return "";
}
