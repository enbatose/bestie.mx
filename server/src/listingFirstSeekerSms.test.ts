import { describe, expect, it } from "vitest";
import {
  buildListingFirstSeekerSms,
  listingFirstSeekerSmsEnabled,
  SMS_NOTIFY_MAX_CHARS,
  seekerFirstName,
} from "./listingFirstSeekerSms.js";

describe("buildListingFirstSeekerSms", () => {
  it("uses first name only and a 4–6 word post lead within 160 characters", () => {
    const text = buildListingFirstSeekerSms([
      {
        seekerName: "Alejandro padilla",
        listingTitle:
          "Renta de 2 cuartos amueblados cerca de Plaza Galerías · Recámara 1 (Guadalajara)",
      },
    ]);
    expect(text).toBe(
      'Bestie.mx: Alejandro te escribió por tu post "Renta de 2 cuartos amueblados cerca". Revisa tu correo regularmente (también spam) o entra en bestie.mx/mensajes',
    );
    expect(Array.from(text ?? "").length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
    expect(text).not.toContain("padilla");
    expect(text).not.toContain("Padilla");
    expect(text).not.toContain("!");
  });

  it("clips the post lead when the title would blow the 160-character cap", () => {
    const text = buildListingFirstSeekerSms([
      {
        seekerName: "Alejandrina",
        listingTitle: "Recámara amueblada privada céntrica luminosa amplia",
      },
    ]);
    expect(text).toContain("te escribió por tu post \"");
    expect(text).toContain("Revisa tu correo regularmente (también spam)");
    expect(Array.from(text ?? "").length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
  });

  it("uses singular otro usuario for two seekers", () => {
    const text = buildListingFirstSeekerSms([
      { seekerName: "Alejandro Padilla", listingTitle: "Cuarto 1" },
      { seekerName: "María López", listingTitle: "Cuarto 2" },
    ]);
    expect(text).toBe(
      "Bestie.mx: Alejandro y otro usuario te escribieron. Revisa tu correo regularmente (también spam) o entra en bestie.mx/mensajes",
    );
    expect(Array.from(text ?? "").length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
  });

  it("uses plural otros N usuarios for three or more seekers", () => {
    const text = buildListingFirstSeekerSms([
      { seekerName: "Alejandro", listingTitle: "A" },
      { seekerName: "María", listingTitle: "B" },
      { seekerName: "Luis", listingTitle: "C" },
    ]);
    expect(text).toContain("Alejandro y otros 2 usuarios te escribieron");
    expect(Array.from(text ?? "").length).toBeLessThanOrEqual(SMS_NOTIFY_MAX_CHARS);
  });

  it("returns null for an empty list", () => {
    expect(buildListingFirstSeekerSms([])).toBeNull();
  });
});

describe("seekerFirstName", () => {
  it("keeps only the first token", () => {
    expect(seekerFirstName("Alejandro padilla")).toBe("Alejandro");
    expect(seekerFirstName("  María José Pérez ")).toBe("María");
    expect(seekerFirstName("")).toBe("un usuario");
  });
});

describe("listingFirstSeekerSmsEnabled", () => {
  it("is on by default and off when LISTING_FIRST_SEEKER_SMS=0", () => {
    const prev = process.env.LISTING_FIRST_SEEKER_SMS;
    delete process.env.LISTING_FIRST_SEEKER_SMS;
    expect(listingFirstSeekerSmsEnabled()).toBe(true);
    process.env.LISTING_FIRST_SEEKER_SMS = "0";
    expect(listingFirstSeekerSmsEnabled()).toBe(false);
    if (prev === undefined) delete process.env.LISTING_FIRST_SEEKER_SMS;
    else process.env.LISTING_FIRST_SEEKER_SMS = prev;
  });
});
