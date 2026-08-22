import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ANALYTICS_HOSTNAMES,
  isAnalyticsAllowedHostname,
  shouldEnablePostHog,
} from "./posthog";

describe("PostHog production-only gate", () => {
  it("allowlists only bestie.mx and www.bestie.mx", () => {
    expect([...PRODUCTION_ANALYTICS_HOSTNAMES].sort()).toEqual(["bestie.mx", "www.bestie.mx"]);
    expect(isAnalyticsAllowedHostname("bestie.mx")).toBe(true);
    expect(isAnalyticsAllowedHostname("www.bestie.mx")).toBe(true);
    expect(isAnalyticsAllowedHostname("WWW.BESTIE.MX")).toBe(true);
  });

  it("blocks Dev, local, and preview hosts even with a token", () => {
    const blocked = [
      "dev.bestie.mx",
      "localhost",
      "127.0.0.1",
      "bestie.mx.evil.com",
      "staging.bestie.mx",
      "",
    ];
    for (const hostname of blocked) {
      expect(isAnalyticsAllowedHostname(hostname), hostname).toBe(false);
      expect(
        shouldEnablePostHog({ projectToken: "phc_test_token", hostname }),
        hostname,
      ).toBe(false);
    }
  });

  it("requires both a token and a production hostname", () => {
    expect(
      shouldEnablePostHog({ projectToken: "", hostname: "www.bestie.mx" }),
    ).toBe(false);
    expect(
      shouldEnablePostHog({ projectToken: "   ", hostname: "bestie.mx" }),
    ).toBe(false);
    expect(
      shouldEnablePostHog({ projectToken: "phc_live", hostname: "bestie.mx" }),
    ).toBe(true);
    expect(
      shouldEnablePostHog({ projectToken: "phc_live", hostname: "www.bestie.mx" }),
    ).toBe(true);
  });
});
