import { describe, expect, it } from "vitest";
import {
  adminOutreachWhatsAppHref,
  adminOutreachWhatsAppMessage,
  adminOutreachWhatsAppPrefillText,
} from "./adminOutreachWhatsApp";

describe("adminOutreachWhatsAppMessage", () => {
  it("includes the publisher name when provided", () => {
    const msg = adminOutreachWhatsAppMessage({
      publisherName: "María",
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    expect(msg).toContain("Hola María,");
    expect(msg).toContain("roomie/cuarto");
    expect(msg).toContain("grupo de Facebook de Guadalajara");
    expect(msg).toContain("🌐 Tu anuncio:");
    expect(msg).toContain("https://www.bestie.mx/anuncio/A12345678");
    expect(msg).toContain("¿Quieres editarla o quitarla tú? 📝");
    expect(msg).toContain("Regístrate en bestie.mx");
    expect(msg).toContain("Mis Anuncios");
    expect(msg).toContain("BAJA");
    expect(msg).toContain("¡Saludos ✌️!");
  });

  it("omits the name when blank", () => {
    const msg = adminOutreachWhatsAppMessage({
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    expect(msg.startsWith("Hola,")).toBe(true);
    expect(msg).not.toContain("Hola ,");
  });
});

describe("adminOutreachWhatsAppPrefillText", () => {
  it("remaps colorful emoji to BMP symbols", () => {
    const safe = adminOutreachWhatsAppPrefillText(
      adminOutreachWhatsAppMessage({
        publisherName: "María",
        listingUrl: "https://www.bestie.mx/anuncio/A12345678",
      }),
    );
    expect(safe).toContain("➡ Tu anuncio:");
    expect(safe).toContain("¿Quieres editarla o quitarla tú? ✎");
    expect(safe).toContain("¡Saludos ✌!");
    expect(safe).not.toContain("🌐");
    expect(safe).not.toContain("📝");
    expect(safe).not.toContain("✌️");
  });
});

describe("adminOutreachWhatsAppHref", () => {
  it("uses api.whatsapp.com with BMP-safe text", () => {
    const msg = adminOutreachWhatsAppMessage({
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    const href = adminOutreachWhatsAppHref("3329306218", msg);
    expect(href).toMatch(
      /^https:\/\/api\.whatsapp\.com\/send\?phone=523329306218&text=/,
    );
    expect(href).toContain(encodeURIComponent("➡"));
    expect(href).not.toMatch(/%F0%9F/);
  });
});
