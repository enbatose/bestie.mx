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
      contactPhone: "+52 33 1863 2070",
    });
    expect(msg).toContain("Hola María,");
    expect(msg).toContain("roomie/cuarto");
    expect(msg).toContain("grupo de Facebook de Guadalajara");
    expect(msg).toContain("🌐 Tu anuncio:");
    expect(msg).toContain("https://www.bestie.mx/anuncio/A12345678");
    expect(msg).toContain("¿Quieres editarla o quitarla tú? 📝");
    expect(msg).toContain("Regístrate en bestie.mx con este número 3318632070 y búscala en Mis Anuncios.");
    expect(msg).not.toContain("+52");
    expect(msg).toContain("Mis Anuncios");
    expect(msg).toContain("BAJA");
    expect(msg).toContain("¡Saludos! ✌");
  });

  it("falls back when contact phone is missing", () => {
    const msg = adminOutreachWhatsAppMessage({
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    expect(msg).toContain("con este mismo celular y búscala");
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
  it("keeps colorful memo emoji and fixes peace sign variation selector", () => {
    const safe = adminOutreachWhatsAppPrefillText(
      adminOutreachWhatsAppMessage({
        publisherName: "María",
        listingUrl: "https://www.bestie.mx/anuncio/A12345678",
      }),
    );
    expect(safe).toContain("🌐 Tu anuncio:");
    expect(safe).toContain("¿Quieres editarla o quitarla tú? 📝");
    expect(safe).toContain("¡Saludos! ✌");
    expect(safe).not.toContain("✌️");
    expect(safe).not.toContain("✎");
    expect(safe).not.toContain("➡");
  });
});

describe("adminOutreachWhatsAppHref", () => {
  it("uses api.whatsapp.com with UTF-8 emoji in text param", () => {
    const msg = adminOutreachWhatsAppMessage({
      listingUrl: "https://www.bestie.mx/anuncio/A12345678",
    });
    const href = adminOutreachWhatsAppHref("3329306218", msg);
    expect(href).toMatch(
      /^https:\/\/api\.whatsapp\.com\/send\?phone=523329306218&text=/,
    );
    expect(href).toContain(encodeURIComponent("🌐"));
    expect(href).toContain(encodeURIComponent("📝"));
    expect(href).toContain(encodeURIComponent("¡Saludos! ✌"));
  });
});
