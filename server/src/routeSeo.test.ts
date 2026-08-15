import { describe, expect, it } from "vitest";
import { injectRouteSeo, resolveRouteSeo } from "./routeSeo.js";

describe("routeSeo", () => {
  it("resolves México hub, Guadalajara landing, and GDL search titles", () => {
    expect(resolveRouteSeo("/")?.title).toMatch(/México/i);
    expect(resolveRouteSeo("/")?.description).toMatch(/marketplace de roomies/i);
    expect(resolveRouteSeo("/guadalajara")?.description).toMatch(/roomie Guadalajara/i);
    expect(resolveRouteSeo("/buscar/gdl")?.title).toMatch(/Roomie GDL/i);
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

  it("swaps the share image for Guadalajara routes and leaves other routes on the default", () => {
    const shell = `<!doctype html><html><head>
<title>Old</title>
<meta property="og:image" content="https://www.bestie.mx/brand/og-default.jpg" />
<meta property="og:image:secure_url" content="https://www.bestie.mx/brand/og-default.jpg" />
<meta property="og:image:alt" content="Old alt" />
<meta name="twitter:image" content="https://www.bestie.mx/brand/og-default.jpg" />
</head><body></body></html>`;

    const gdl = injectRouteSeo(shell, resolveRouteSeo("/gdl")!, "https://www.bestie.mx");
    expect(gdl).toContain('property="og:image" content="https://www.bestie.mx/brand/og-gdl.jpg"');
    expect(gdl).toContain(
      'property="og:image:secure_url" content="https://www.bestie.mx/brand/og-gdl.jpg"',
    );
    expect(gdl).toContain('name="twitter:image" content="https://www.bestie.mx/brand/og-gdl.jpg"');
    expect(gdl).toMatch(/og:image:alt" content="[^"]*Minerva/);
    expect(gdl).not.toContain("og-default.jpg");

    const buscarGdl = injectRouteSeo(shell, resolveRouteSeo("/buscar/gdl")!, "https://www.bestie.mx");
    expect(buscarGdl).toContain('property="og:image" content="https://www.bestie.mx/brand/og-gdl.jpg"');

    // Bare /buscar stays on the default card so future cities don't inherit Minerva.
    const buscar = injectRouteSeo(shell, resolveRouteSeo("/buscar")!, "https://www.bestie.mx");
    expect(buscar).toContain('property="og:image" content="https://www.bestie.mx/brand/og-default.jpg"');

    const faq = injectRouteSeo(shell, resolveRouteSeo("/faq")!, "https://www.bestie.mx");
    expect(faq).toContain('property="og:image" content="https://www.bestie.mx/brand/og-default.jpg"');
  });

  it("marks /publicar as noindex with a canonical that ignores query drafts", () => {
    const seo = resolveRouteSeo("/publicar")!;
    expect(seo.canonicalPath).toBe("/publicar");
    expect(seo.noindex).toBe(true);
    const shell = `<!doctype html><html><head><title>Old</title></head><body></body></html>`;
    const out = injectRouteSeo(shell, seo, "https://www.bestie.mx");
    expect(out).toContain('rel="canonical" href="https://www.bestie.mx/publicar"');
    expect(out).toContain('name="robots" content="noindex, nofollow"');
  });
});
