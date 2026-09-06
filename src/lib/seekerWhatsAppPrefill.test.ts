import { describe, expect, it } from "vitest";
import { seekerWhatsAppHref, seekerWhatsAppPrefill, whatsAppItalic } from "./seekerWhatsAppPrefill";

describe("seekerWhatsAppPrefill", () => {
  it("wraps the listing title in WhatsApp italic markers", () => {
    const msg = seekerWhatsAppPrefill({
      publisherName: "Ana",
      seekerName: "Luis",
      listingTitle: "Cuarto en Americana",
    });
    expect(msg).toBe(
      "Hola Ana, soy Luis — Vi tu publicación _Cuarto en Americana_ en Bestie.mx, quisiera pedir más información y confirmar si aún está disponible.",
    );
    expect(whatsAppItalic("Cuarto _especial_")).toBe("_Cuarto especial_");
  });

  it("falls back when names are missing", () => {
    expect(seekerWhatsAppPrefill({ listingTitle: "Loft" })).toContain("Hola, soy un usuario de Bestie");
    expect(seekerWhatsAppHref("3312345678", "hola")!).toContain("api.whatsapp.com/send?phone=523312345678");
  });
});
