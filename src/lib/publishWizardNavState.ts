import { listingPublicPath } from "@/lib/listingReference";

const CLAIM_PREVIEW_PATH = /^\/anuncio\/A[A-Fa-f0-9]{8}\?claim=[A-Za-z0-9_-]+$/;
const BORRADOR_PATH = /^\/borrador\/[A-Za-z0-9_-]+$/;

/** Claim-link draft URL admins open from outreach (`/anuncio/A…?claim=…`). */
export function listingClaimPreviewPath(listingId: string, claimToken: string): string {
  const token = claimToken.trim();
  return `${listingPublicPath(listingId)}?claim=${encodeURIComponent(token)}`;
}

/** Reject open redirects; only allow in-app claim/borrador paths. */
export function sanitizeClaimDraftReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (CLAIM_PREVIEW_PATH.test(t) || BORRADOR_PATH.test(t)) return t;
  return null;
}

export function readClaimDraftReturnPath(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  return sanitizeClaimDraftReturnPath((state as { claimDraftReturnPath?: unknown }).claimDraftReturnPath);
}

/** Location.state slice preserved while `/publicar` rewrites `?edit=` / `?vista=`. */
export function publishWizardNavPatch(opts: {
  fromAdminPosts?: boolean;
  claimDraftReturnPath?: string | null;
}): Record<string, unknown> | null {
  const next: Record<string, unknown> = {};
  if (opts.fromAdminPosts) next.fromAdminPosts = true;
  const claim = sanitizeClaimDraftReturnPath(opts.claimDraftReturnPath);
  if (claim) next.claimDraftReturnPath = claim;
  return Object.keys(next).length ? next : null;
}
