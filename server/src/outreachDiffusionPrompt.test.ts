import { describe, expect, it } from "vitest";
import {
  DIFFUSION_COMMENT_SIGN_OFF,
  buildTemplateOutreachDiffusion,
  diffusionPublicShareUrl,
  finalizeOutreachDiffusionCopy,
} from "./outreachDiffusionPrompt.js";

describe("diffusionPublicShareUrl", () => {
  it("forces www prod origin", () => {
    expect(diffusionPublicShareUrl("/busquedas/abc")).toBe("https://www.bestie.mx/busquedas/abc");
    expect(diffusionPublicShareUrl("https://dev.bestie.mx/busquedas/abc")).toBe(
      "https://www.bestie.mx/busquedas/abc",
    );
  });
});

describe("finalizeOutreachDiffusionCopy", () => {
  it("ensures URL, free pillars survive scrub, and sign-off", () => {
    const url = "https://www.bestie.mx/busquedas/abc";
    const out = finalizeOutreachDiffusionCopy(
      "Hola, en Bestie.mx es gratis publicar y buscar.\nAtte. Equipo Bestie",
      "/busquedas/abc",
    );
    expect(out).toContain(url);
    expect(out.endsWith(DIFFUSION_COMMENT_SIGN_OFF)).toBe(true);
    expect(out.match(/https?:\/\/[^\s]+/g)).toEqual([url]);
    const withoutUrl = out.replace(url, "");
    expect(withoutUrl).not.toMatch(/\bbestie\.mx\b/i);
  });
});

describe("buildTemplateOutreachDiffusion", () => {
  it("mentions free publish/search/contact and includes the link", () => {
    const text = buildTemplateOutreachDiffusion({
      sharePath: "/busquedas/gdlchapu",
      seekerName: "María",
      zoneRule: "Chapultepec",
      exactCount: 5,
      similarCount: 2,
      variantSeed: "gdlchapu",
    }).toLowerCase();
    expect(text).toContain("maría");
    expect(text).toContain("https://www.bestie.mx/busquedas/gdlchapu");
    expect(text.includes("gratis") || text.includes("no cuesta")).toBe(true);
    expect(text.includes("publicar") && text.includes("buscar") && (text.includes("contactar") || text.includes("escribirle") || text.includes("anunciante"))).toBe(
      true,
    );
  });
});
