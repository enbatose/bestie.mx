import { describe, expect, it } from "vitest";
import {
  formatFriendlyEmailDateTime,
  mexicoCityTimeZone,
  resolveTimeZoneForConversation,
  resolveTimeZoneForListingCity,
} from "./emailDateTime.js";
import { buildMessageDigestEmail } from "./messageDigestEmail.js";

describe("emailDateTime", () => {
  it("uses Monterrey TZ for Monterrey listings", () => {
    const tz = resolveTimeZoneForListingCity("Monterrey");
    expect(tz.timeZone).toBe("America/Monterrey");
    expect(tz.showTimeZoneNote).toBe(false);
  });

  it("falls back to Mexico City for support conversations", () => {
    const tz = resolveTimeZoneForConversation({ kind: "support", city: null });
    expect(tz).toEqual(mexicoCityTimeZone());
  });

  it("formats today with timezone note for Mexico City fallback", () => {
    const now = new Date("2026-07-19T18:00:00.000Z");
    const label = formatFriendlyEmailDateTime(
      "2026-07-19T17:30:00.000Z",
      mexicoCityTimeZone(),
      now,
    );
    expect(label).toMatch(/^Hoy,/);
    expect(label).toContain("hora del centro de México");
  });
});

describe("buildMessageDigestEmail", () => {
  it("links to /notifications and includes timestamps", () => {
    const mail = buildMessageDigestEmail({
      displayName: "Enrique",
      unreadMessageCount: 2,
      messages: [
        {
          contextTitle: "Casa en Americana · Recámara (Guadalajara)",
          whenLabel: "Hoy, 2:30 p. m. (hora de Guadalajara)",
        },
        {
          contextTitle: "Soporte Bestie",
          whenLabel: "Ayer, 9:00 a. m. (hora del centro de México · Ciudad de México)",
        },
      ],
      notifications: [
        {
          text: "Has publicado exitosamente tu anuncio.",
          link: "/mis-anuncios",
          whenLabel: "Hoy, 1:00 p. m. (hora del centro de México · Ciudad de México)",
        },
      ],
    });
    expect(mail.html).toContain("/notifications");
    expect(mail.html).not.toContain("/notificaciones");
    expect(mail.html).toContain("logo-lockup-on-dark.svg");
    expect(mail.html).toContain("hora de Guadalajara");
    expect(mail.html).toContain("Soporte Bestie");
    expect(mail.text).toContain("Ver notificaciones:");
    expect(mail.text).toContain("/notifications");
  });
});
