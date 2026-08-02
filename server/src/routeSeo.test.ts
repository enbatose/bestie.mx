import { describe, expect, it } from "vitest";
import { injectRouteSeo, resolveRouteSeo } from "./routeSeo.js";

describe("routeSeo", () => {
  it("resolves Guadalajara search and home intent titles", () => {
    expect(resolveRouteSeo("/buscar/gdl")?.title).toMatch(/Roomie GDL/i);
    expect(resolveRouteSeo("/")?.description).toMatch(/roomie en Guadalajara/i);
    expect(resolveRouteSeo("/nosotros")?.canonicalPath).toBe("/nosotros");
  });

  it("injects title, description, and canonical into the SPA shell", () => {
    const shell = `<!doctype html><html><head>
<title>Old</title>
<meta name="description" content="Old desc" />
<meta property="og:title" content="Old" />
</head><body></body></html>`;
    const seo = resolveRouteSeo("/faq")!;
    const out = injectRouteSeo(shell, seo, "https://www.bestie.mx");
    expect(out).toContain(seo.title);
    expect(out).toContain(seo.description);
    expect(out).toContain('rel="canonical" href="https://www.bestie.mx/faq"');
  });
});
