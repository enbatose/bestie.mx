import { describe, expect, it } from "vitest";
import {
  DIFFUSION_COMMENT_SIGN_OFF,
  buildDiffusionFacebookComment,
  diffusionPublicShareUrl,
} from "./outreachDiffusionComment";

describe("diffusionPublicShareUrl", () => {
  it("forces www prod origin for relative paths", () => {
    expect(diffusionPublicShareUrl("/busquedas/abc123")).toBe("https://www.bestie.mx/busquedas/abc123");
  });

  it("rewrites Dev absolute URLs to www", () => {
    expect(diffusionPublicShareUrl("https://dev.bestie.mx/busquedas/abc123")).toBe(
      "https://www.bestie.mx/busquedas/abc123",
    );
  });
});

describe("buildDiffusionFacebookComment", () => {
  it("includes greeting, zone, counts, free pillars, single URL, and sign-off", () => {
    const text = buildDiffusionFacebookComment({
      sharePath: "/busquedas/gdlchapu",
      seekerName: "María López",
      zoneRule: "Zona Chapultepec / Americana",
      exactCount: 8,
      similarCount: 4,
      variantSeed: "gdlchapu",
      variantOffset: 0,
    });
    expect(text).toMatch(/María/);
    expect(text).toMatch(/Chapultepec/);
    expect(text).toMatch(/8 en zona/);
    expect(text.toLowerCase()).toMatch(/gratis|no cuesta/);
    expect(text.toLowerCase()).toMatch(/publicar/);
    expect(text.toLowerCase()).toMatch(/buscar/);
    expect(text).toContain("https://www.bestie.mx/busquedas/gdlchapu");
    expect(text.endsWith(DIFFUSION_COMMENT_SIGN_OFF)).toBe(true);
    const withoutUrl = text.replace("https://www.bestie.mx/busquedas/gdlchapu", "");
    expect(withoutUrl).not.toMatch(/\bbestie\.mx\b/i);
    const urlHits = text.match(/https:\/\/www\.bestie\.mx\/busquedas\/gdlchapu/g) ?? [];
    expect(urlHits).toHaveLength(1);
  });

  it("works without name or counts", () => {
    const text = buildDiffusionFacebookComment({
      sharePath: "/busquedas/xyz",
      variantSeed: "xyz",
    });
    expect(text).toMatch(/^Hola|^Qué tal/i);
    expect(text).toContain("https://www.bestie.mx/busquedas/xyz");
    expect(text.endsWith(DIFFUSION_COMMENT_SIGN_OFF)).toBe(true);
  });

  it("changes wording when variantOffset changes", () => {
    const a = buildDiffusionFacebookComment({
      sharePath: "/busquedas/xyz",
      seekerName: "Carlos",
      zoneRule: "Centro",
      exactCount: 5,
      variantSeed: "xyz",
      variantOffset: 0,
    });
    const b = buildDiffusionFacebookComment({
      sharePath: "/busquedas/xyz",
      seekerName: "Carlos",
      zoneRule: "Centro",
      exactCount: 5,
      variantSeed: "xyz",
      variantOffset: 1,
    });
    expect(a).not.toBe(b);
  });
});
