/**
 * Cookie / tracking consent (LFPDPPP).
 * Essential session cookies never need consent. Analytics (PostHog) and marketing
 * (Meta Pixel) only run after an explicit choice stored in localStorage.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "bestie_cookie_consent_v1";
/** Bump when the consent categories or legal meaning change (forces re-prompt). */
export const COOKIE_CONSENT_VERSION = "2026-08-23-v1";

export type CookieConsentChoice = {
  version: string;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export const COOKIE_CONSENT_CHANGED_EVENT = "bestie:cookie-consent-changed";

/** In-memory fallback when localStorage is unavailable (SSR / tests). */
let memoryConsent: CookieConsentChoice | null = null;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseChoice(raw: unknown): CookieConsentChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<CookieConsentChoice>;
  if (
    typeof parsed.version !== "string" ||
    parsed.version !== COOKIE_CONSENT_VERSION ||
    typeof parsed.analytics !== "boolean" ||
    typeof parsed.marketing !== "boolean" ||
    typeof parsed.decidedAt !== "string"
  ) {
    return null;
  }
  return {
    version: parsed.version,
    analytics: parsed.analytics,
    marketing: parsed.marketing,
    decidedAt: parsed.decidedAt,
  };
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (canUseStorage()) {
    try {
      const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!raw) return memoryConsent;
      return parseChoice(JSON.parse(raw)) ?? memoryConsent;
    } catch {
      return memoryConsent;
    }
  }
  return memoryConsent;
}

export function hasCookieConsentDecision(): boolean {
  return readCookieConsent() !== null;
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function hasMarketingConsent(): boolean {
  return readCookieConsent()?.marketing === true;
}

export function writeCookieConsent(input: {
  analytics: boolean;
  marketing: boolean;
}): CookieConsentChoice {
  const choice: CookieConsentChoice = {
    version: COOKIE_CONSENT_VERSION,
    analytics: input.analytics,
    marketing: input.marketing,
    decidedAt: new Date().toISOString(),
  };
  memoryConsent = choice;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(choice));
    } catch {
      /* private mode / quota — memory still holds this session */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: choice }));
  }
  return choice;
}

export function acceptAllCookies(): CookieConsentChoice {
  return writeCookieConsent({ analytics: true, marketing: true });
}

export function rejectNonEssentialCookies(): CookieConsentChoice {
  return writeCookieConsent({ analytics: false, marketing: false });
}

/** Test helper — clears memory + storage. */
export function resetCookieConsentForTests(): void {
  memoryConsent = null;
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
