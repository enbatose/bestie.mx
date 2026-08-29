import { describe, expect, it } from "vitest";
import {
  absoluteUploadUrl,
  buildPropertyShareOg,
  buildRoomShareOg,
  coverImageForPost,
  injectFacebookAppId,
  injectListingShareOg,
  OG_DESC_MAX,
  OG_TITLE_MAX,
  truncateOgText,
} from "./listingShareOg.js";
import type { PropertyListing } from "./types.js";

function baseListing(over: Partial<PropertyListing> = {}): PropertyListing {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    propertyId: "prp__11111111-2222-3333-4444-555555555555",
    title: "Casa en Providencia · Recámara 1",
    propertyTitle: "Casa en Providencia",
    city: "Guadalajara",
    neighborhood: "Providencia",
    lat: 20.7,
    lng: -103.4,
    rentMxn: 8500,
    depositMxn: 8500,
    propertyBedroomsTotal: 3,
    propertyBathrooms: 2,
    showWhatsApp: false,
    roomsAvailable: 1,
    tags: [],
    roommateGenderPref: "any",
    ageMin: 18,
    ageMax: 99,
    summary: "Recámara luminosa con baño propio y excelente ubicación cerca del parque.",
    contactWhatsApp: "",
    status: "published",
    propertyStatus: "published",
    propertyPostMode: "room",
    lodgingType: "private_room",
    roomImageUrls: ["/api/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg"],
    propertyImageUrls: ["/api/uploads/11111111-2222-3333-4444-555555555555.jpg"],
    ...over,
  };
}

describe("listingShareOg helpers", () => {
  it("truncates at a word boundary within Facebook-oriented limits", () => {
    const long = "Palabra ".repeat(40).trim();
    const out = truncateOgText(long, OG_DESC_MAX);
    expect(out.length).toBeLessThanOrEqual(OG_DESC_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it("absoluteUploadUrl accepts upload paths only", () => {
    expect(absoluteUploadUrl("https://dev.bestie.mx", "/api/uploads/a.jpg")).toBe(
      "https://dev.bestie.mx/api/uploads/a.jpg",
    );
    expect(absoluteUploadUrl("https://dev.bestie.mx", "../etc/passwd")).toBeNull();
    expect(absoluteUploadUrl("https://dev.bestie.mx", "https://cdn.example/x.jpg")).toBeNull();
  });

  it("coverImageForPost prefers room photos for room mode and property for property mode", () => {
    const l = baseListing();
    expect(coverImageForPost("https://www.bestie.mx", l, "room")).toContain("/api/share-og/anuncio/");
    expect(coverImageForPost("https://www.bestie.mx", l, "property")).toContain(
      "/api/share-og/propiedad/",
    );
  });

  it("buildRoomShareOg includes price, place, and summary", () => {
    const meta = buildRoomShareOg(baseListing({ propertyPostMode: "room", title: "Casa en Providencia" }), "https://www.bestie.mx");
    expect(meta.title.length).toBeLessThanOrEqual(OG_TITLE_MAX);
    expect(meta.title).toContain("Providencia");
    expect(meta.description).toContain("8,500");
    expect(meta.description).toContain("Providencia");
    expect(meta.description.length).toBeLessThanOrEqual(OG_DESC_MAX);
    expect(meta.url).toMatch(/\/anuncio\/A/);
    expect(meta.imageUrl).toContain("/api/share-og/anuncio/");
  });

  it("buildPropertyShareOg includes price range and available room count", () => {
    const a = baseListing({ rentMxn: 7000, id: "r1" });
    const b = baseListing({ rentMxn: 9000, id: "r2" });
    const meta = buildPropertyShareOg(
      "Casa grande",
      { neighborhood: "Lafayette", city: "Guadalajara" },
      [a, b],
      a,
      a.propertyId,
      "Varias recámaras disponibles en zona céntrica.",
      "https://www.bestie.mx",
    );
    expect(meta.title).toBe("Casa grande");
    expect(meta.description).toContain("7,000");
    expect(meta.description).toContain("9,000");
    expect(meta.description).toContain("2 cuartos disponibles");
    expect(meta.url).toMatch(/\/propiedad\/P/);
    expect(meta.imageUrl).toContain("/api/share-og/propiedad/");
  });

  it("injectListingShareOg replaces default OG tags and adds image", () => {
    const prev = process.env.FACEBOOK_APP_ID;
    process.env.FACEBOOK_APP_ID = "123456789012345";
    const html = `<!doctype html><html><head>
<meta property="og:title" content="Bestie — bestie.mx" />
<meta property="og:description" content="Generic" />
<meta property="og:url" content="https://www.bestie.mx" />
<meta name="description" content="Generic" />
<title>Bestie — bestie.mx</title>
</head><body></body></html>`;
    try {
      const out = injectListingShareOg(html, {
        title: 'Cuarto "top" en GDL',
        description: "8500 MXN/mes · Providencia",
        url: "https://www.bestie.mx/anuncio/AABCDEF12",
        imageUrl: "https://www.bestie.mx/api/uploads/x.jpg",
      });
      expect(out).toContain('property="og:title" content="Cuarto &quot;top&quot; en GDL"');
      expect(out).toContain('property="og:image" content="https://www.bestie.mx/api/uploads/x.jpg"');
      expect(out).toContain('name="twitter:card" content="summary_large_image"');
      expect(out).toContain('property="fb:app_id" content="123456789012345"');
      expect(out).not.toContain("Bestie — bestie.mx");
    } finally {
      if (prev === undefined) delete process.env.FACEBOOK_APP_ID;
      else process.env.FACEBOOK_APP_ID = prev;
    }
  });

  it("injectListingShareOg can omit JSON-LD and mark claim links noindex", () => {
    const html = `<!doctype html><html><head>
<title>Bestie — bestie.mx</title>
</head><body></body></html>`;
    const out = injectListingShareOg(html, {
      title: "Cuarto claim",
      description: "5,500 MXN/mes · Atlas",
      url: "https://www.bestie.mx/anuncio/AABCDEF12?claim=tok",
      imageUrl: "https://www.bestie.mx/api/share-og/anuncio/AABCDEF12.jpg",
      noIndex: true,
    });
    expect(out).toContain('name="robots" content="noindex, nofollow"');
    expect(out).toContain("/api/share-og/anuncio/AABCDEF12.jpg");
    expect(out).not.toContain("application/ld+json");
    expect(out).not.toContain("3316979814");
  });

  it("injectFacebookAppId is a no-op without FACEBOOK_APP_ID", () => {
    const html = "<html><head></head><body></body></html>";
    expect(injectFacebookAppId(html, null)).toBe(html);
    expect(injectFacebookAppId(html, "999")).toContain('property="fb:app_id" content="999"');
  });
});
