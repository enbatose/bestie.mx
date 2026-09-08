import { describe, expect, it } from "vitest";
import { collapseZonePhrase } from "./gdlSearchPois.js";
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

describe("finalizeOutreachDiffusionCopy phone claims", () => {
  it("drops a seeker phone presented as Bestie's number", () => {
    const url = "https://www.bestie.mx/busquedas/kkpdnmyy";
    const out = finalizeOutreachDiffusionCopy(
      `Hola Alejandro. En Bestie preparamos una búsqueda. Si tienes dudas, también puedes escribirnos al 3327082113. Te comparto el enlace:\n\n${url}\n\nAtte. Equipo Bestie MX.`,
      url,
    );
    expect(out).not.toContain("3327082113");
    expect(out.toLowerCase()).not.toMatch(/escribirnos|llámanos|escríbenos/);
    expect(out).toContain(url);
    expect(out.endsWith(DIFFUSION_COMMENT_SIGN_OFF)).toBe(true);
  });
});

describe("collapseZonePhrase", () => {
  it("does not list Colonia Americana beside the Chapultepec/Americana pin", () => {
    expect(collapseZonePhrase("Zona Chapultepec/Americana, Centro o Colonia Americana")).toBe(
      "Zona Chapultepec/Americana o Centro",
    );
  });
});

describe("finalizeOutreachDiffusionCopy place names", () => {
  it("does not split Colonia Americana into a bare Colonia", () => {
    const url = "https://www.bestie.mx/busquedas/nha5mzfy";
    const out = finalizeOutreachDiffusionCopy(
      `Hola Shady, te armamos una búsqueda con opciones en la zona de Chapultepec, Americana, Centro y Colonia para tu home office. Tenemos 1 opción en zona para que revises con calma. En Bestie es gratis publicar, buscar y contactar al anunciante.\n\n${url}\n\nAtte. Equipo Bestie MX.`,
      url,
      "Zona Chapultepec/Americana, Centro o Colonia Americana",
    );
    expect(out).toContain("Zona Chapultepec/Americana o Centro");
    expect(out).not.toMatch(/\bColonia\b(?!\s+Americana)/);
    expect(out).not.toMatch(/Chapultepec, Americana/);
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
