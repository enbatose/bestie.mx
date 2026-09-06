import { describe, expect, it } from "vitest";
import { buildListingFirstSeekerSms, listingFirstSeekerSmsEnabled } from "./listingFirstSeekerSms.js";

describe("buildListingFirstSeekerSms", () => {
  it("names the seeker and listing on a single first message", () => {
    const text = buildListingFirstSeekerSms([
      { seekerName: "Alejandro Padilla", listingTitle: "Renta cerca de Plaza Galerías · Recámara 1" },
    ]);
    expect(text).toContain("Bestie.mx:");
    expect(text).toContain("Alejandro Padilla te escribió por \"");
    expect(text).toContain("Revisa tu correo de Bestie cada 2-3 h (mira también spam)");
    expect(text).toContain("bestie.mx/mensajes");
    expect(text).not.toContain("!");
  });

  it("uses singular otro usuario for two seekers", () => {
    const text = buildListingFirstSeekerSms([
      { seekerName: "Alejandro", listingTitle: "Cuarto 1" },
      { seekerName: "María", listingTitle: "Cuarto 2" },
    ]);
    expect(text).toBe(
      "Bestie.mx: Alejandro y otro usuario te escribieron. Revisa tu correo de Bestie cada 2-3 h (mira también spam) o entra en bestie.mx/mensajes",
    );
  });

  it("uses plural otros N usuarios for three or more seekers", () => {
    const text = buildListingFirstSeekerSms([
      { seekerName: "Alejandro", listingTitle: "A" },
      { seekerName: "María", listingTitle: "B" },
      { seekerName: "Luis", listingTitle: "C" },
    ]);
    expect(text).toContain("Alejandro y otros 2 usuarios te escribieron");
  });

  it("returns null for an empty list", () => {
    expect(buildListingFirstSeekerSms([])).toBeNull();
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
