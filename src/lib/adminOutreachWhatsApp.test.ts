import { describe, expect, it } from "vitest";
import {
  FB_OUTREACH_GROUP_NAME,
  adminOutreachWhatsAppHref,
  adminOutreachWhatsAppMessage,
} from "./adminOutreachWhatsApp";

describe("adminOutreachWhatsAppMessage", () => {
  it("includes the publisher name when provided", () => {
    const msg = adminOutreachWhatsAppMessage({
      publisherName: "María",
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    expect(msg).toContain("Hola María,");
    expect(msg).toContain("grupo de Facebook");
    expect(msg).toContain(FB_OUTREACH_GROUP_NAME);
    expect(msg).toContain("https://www.bestie.mx/anuncio/A12345678");
    expect(msg).toContain("Mis Anuncios");
    expect(msg).toContain("BAJA");
  });

  it("omits the name when blank", () => {
    const msg = adminOutreachWhatsAppMessage({
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    expect(msg.startsWith("Hola,")).toBe(true);
    expect(msg).not.toContain("Hola ,");
  });
});

describe("adminOutreachWhatsAppHref", () => {
  it("encodes the prefilled message for wa.me", () => {
    const href = adminOutreachWhatsAppHref("3329306218", "Hola\nGracias.");
    expect(href).toBe("https://wa.me/+523329306218?text=Hola%0AGracias.");
  });
});
