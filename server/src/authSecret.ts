/**
 * Shared AUTH_JWT_SECRET resolution for sessions, OTP peppers, and OAuth state.
 * Production must set a strong secret; never fall back to the known dev string there.
 */
import { randomBytes } from "node:crypto";

const DEV_FALLBACK = "dev-insecure-auth-secret-change-me";
const MIN_PROD_LEN = 32;

let ephemeralProdSecret: string | null = null;

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Throws when production is missing a usable AUTH_JWT_SECRET (call at process start). */
export function assertAuthSecretConfigured(): void {
  if (!isProductionRuntime()) return;
  const s = process.env.AUTH_JWT_SECRET?.trim();
  if (!s || s.length < MIN_PROD_LEN) {
    throw new Error(
      `AUTH_JWT_SECRET must be set to at least ${MIN_PROD_LEN} characters in production (got ${s ? s.length : 0}).`,
    );
  }
}

/**
 * Cryptographic secret for HMAC / peppering.
 * - Production: requires AUTH_JWT_SECRET (assertAuthSecretConfigured at boot).
 * - Non-production: env or known local fallback.
 */
export function authSecret(): string {
  const s = process.env.AUTH_JWT_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (isProductionRuntime()) {
    // Boot should have failed already; keep a last-resort ephemeral secret so a
    // mid-request misconfig cannot fall back to the public DEV_FALLBACK string.
    if (!ephemeralProdSecret) {
      ephemeralProdSecret = randomBytes(32).toString("hex");
      console.error(
        "[auth] AUTH_JWT_SECRET missing at runtime in production; using ephemeral secret (sessions will not survive restarts).",
      );
    }
    return ephemeralProdSecret;
  }
  return DEV_FALLBACK;
}
