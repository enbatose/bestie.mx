import { afterEach, describe, expect, it } from "vitest";
import { publicBaseUrl, sharePreviewBaseUrl } from "./publicBaseUrl.js";

describe("publicBaseUrl", () => {
  const keys = ["PUBLIC_BASE_URL", "SITE_URL", "WEB_ORIGIN", "PUBLIC_WEB_ORIGIN"] as const;
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  function snapshotEnv() {
    for (const k of keys) prev[k] = process.env[k];
    for (const k of keys) delete process.env[k];
  }

  it("falls back to www when no env is set", () => {
    snapshotEnv();
    expect(publicBaseUrl()).toBe("https://www.bestie.mx");
  });

  it("honors PUBLIC_WEB_ORIGIN (Railway Dev)", () => {
    snapshotEnv();
    process.env.PUBLIC_WEB_ORIGIN = "https://dev.bestie.mx/";
    expect(publicBaseUrl()).toBe("https://dev.bestie.mx");
  });

  it("prefers PUBLIC_BASE_URL over PUBLIC_WEB_ORIGIN", () => {
    snapshotEnv();
    process.env.PUBLIC_BASE_URL = "https://www.bestie.mx";
    process.env.PUBLIC_WEB_ORIGIN = "https://dev.bestie.mx";
    expect(publicBaseUrl()).toBe("https://www.bestie.mx");
  });
});

describe("sharePreviewBaseUrl", () => {
  it("uses request Host for Dev", () => {
    const req = { get: (n: string) => (n === "host" ? "dev.bestie.mx" : undefined) };
    expect(sharePreviewBaseUrl(req)).toBe("https://dev.bestie.mx");
  });

  it("normalizes bare bestie.mx to www", () => {
    const req = { get: (n: string) => (n === "host" ? "bestie.mx" : undefined) };
    expect(sharePreviewBaseUrl(req)).toBe("https://www.bestie.mx");
  });
});
