import { afterEach, describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  acceptAllCookies,
  hasAnalyticsConsent,
  hasCookieConsentDecision,
  hasMarketingConsent,
  readCookieConsent,
  rejectNonEssentialCookies,
  resetCookieConsentForTests,
  writeCookieConsent,
} from "./cookieConsent";

afterEach(() => {
  resetCookieConsentForTests();
});

describe("cookieConsent", () => {
  it("starts with no decision", () => {
    expect(hasCookieConsentDecision()).toBe(false);
    expect(hasAnalyticsConsent()).toBe(false);
    expect(hasMarketingConsent()).toBe(false);
    expect(readCookieConsent()).toBeNull();
  });

  it("stores accept-all", () => {
    const choice = acceptAllCookies();
    expect(choice.version).toBe(COOKIE_CONSENT_VERSION);
    expect(choice.analytics).toBe(true);
    expect(choice.marketing).toBe(true);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(hasMarketingConsent()).toBe(true);
  });

  it("stores reject non-essential", () => {
    rejectNonEssentialCookies();
    expect(hasCookieConsentDecision()).toBe(true);
    expect(hasAnalyticsConsent()).toBe(false);
    expect(hasMarketingConsent()).toBe(false);
  });

  it("ignores stale consent versions", () => {
    writeCookieConsent({ analytics: true, marketing: true });
    // Simulate a stale stored payload by writing raw JSON with wrong version.
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        JSON.stringify({
          version: "old-version",
          analytics: true,
          marketing: true,
          decidedAt: "2020-01-01T00:00:00.000Z",
        }),
      );
      // Clear memory so read falls through to the stale storage entry.
      resetCookieConsentForTests();
      window.localStorage.setItem(
        COOKIE_CONSENT_STORAGE_KEY,
        JSON.stringify({
          version: "old-version",
          analytics: true,
          marketing: true,
          decidedAt: "2020-01-01T00:00:00.000Z",
        }),
      );
      expect(readCookieConsent()).toBeNull();
      expect(hasAnalyticsConsent()).toBe(false);
    } else {
      // Node/vitest without DOM: stale storage cannot be simulated; memory path only.
      resetCookieConsentForTests();
      expect(readCookieConsent()).toBeNull();
    }
  });

  it("allows custom mix", () => {
    writeCookieConsent({ analytics: true, marketing: false });
    expect(hasAnalyticsConsent()).toBe(true);
    expect(hasMarketingConsent()).toBe(false);
  });
});
