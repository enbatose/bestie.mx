import { describe, expect, it } from "vitest";
import { adminOutreachWhatsAppHref, adminOutreachWhatsAppMessage } from "./adminOutreachWhatsApp";

describe("adminOutreachWhatsAppMessage", () => {
  it("includes the publisher name when provided", () => {
    const msg = adminOutreachWhatsAppMessage({
      publisherName: "María",
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    expect(msg).toContain("Hola María,");
    expect(msg).toContain("roomie/cuarto");
    expect(msg).toContain("grupo de Facebook de Guadalajara");
    expect(msg).toContain("🌐Tu anuncio:");
    expect(msg).toContain("https://www.bestie.mx/anuncio/A12345678");
    expect(msg).toContain("¿Quieres editarla o quitarla tú? 📝");
    expect(msg).toContain("Regístrate en bestie.mx");
    expect(msg).toContain("Mis Anuncios");
    expect(msg).toContain("BAJA");
    expect(msg).toContain("¡Saludos✌️! ");
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

  it("encodes emoji in the prefilled message", () => {
    const msg = adminOutreachWhatsAppMessage({
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    const href = adminOutreachWhatsAppHref("3329306218", msg);
    expect(href).toContain("https://wa.me/+523329306218?text=");
    expect(href).toContain(encodeURIComponent("🌐"));
    expect(href).toContain(encodeURIComponent("📝"));
    expect(href).toContain(encodeURIComponent("✌"));
  });
});
