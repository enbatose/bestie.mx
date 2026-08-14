import { describe, expect, it } from "vitest";
import { buildNewPostPublishedEmail, NEW_POST_OPS_EMAIL } from "./newPostPublishedEmail.js";

describe("newPostPublishedEmail", () => {
  it("includes post link, replay link, and ops category", () => {
    const mail = buildNewPostPublishedEmail({
      title: "Cuarto en Americana",
      city: "Guadalajara",
      neighborhood: "Americana",
      postUrl: "https://www.bestie.mx/anuncio/AABCDEF12",
      replayUrl: "https://us.posthog.com/project/517444/replay/sess-1",
      publisherName: "Ana",
      publisherEmail: "ana@test.mx",
      shortId: "AABCDEF12",
    });
    expect(NEW_POST_OPS_EMAIL).toBe("contacto@bestie.mx");
    expect(mail.subject).toContain("Cuarto en Americana");
    expect(mail.html).toContain("https://www.bestie.mx/anuncio/AABCDEF12");
    expect(mail.html).toContain("https://us.posthog.com/project/517444/replay/sess-1");
    expect(mail.html).toContain("Ver replay de PostHog");
    expect(mail.text).toContain("Replay PostHog:");
    expect(mail.tags?.some((t) => t.name === "category" && t.value === "new_post_alert")).toBe(true);
  });

  it("explains when replay is missing", () => {
    const mail = buildNewPostPublishedEmail({
      title: "Loft",
      city: "GDL",
      neighborhood: "Centro",
      postUrl: "https://dev.bestie.mx/propiedad/P12345678",
      replayUrl: null,
      publisherName: null,
      publisherEmail: null,
      shortId: "P12345678",
    });
    expect(mail.html).toContain("No hay replay de PostHog");
    expect(mail.text).toContain("no disponible");
    expect(mail.html).toContain("Invitado");
  });
});
