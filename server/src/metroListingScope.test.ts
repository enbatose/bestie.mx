import { describe, expect, it } from "vitest";
import { resolveMetroCity } from "./metroCities.js";
import { countSearchCards, listingInMetro } from "./metroListingScope.js";

const gdl = resolveMetroCity("gdl");

describe("listingInMetro", () => {
  it("accepts every ZMG municipality, not only Guadalajara", () => {
    for (const city of ["Guadalajara", "Zapopan", "San Pedro Tlaquepaque", "Tonalá"]) {
      expect(listingInMetro({ city, lat: 0, lng: 0 }, gdl)).toBe(true);
    }
  });

  it("accepts a colonia stored as city when the point sits inside the metro viewbox", () => {
    expect(listingInMetro({ city: "Americana", lat: 20.6736, lng: -103.3705 }, gdl)).toBe(true);
  });

  it("rejects listings outside the metro", () => {
    expect(listingInMetro({ city: "Mérida", lat: 20.9674, lng: -89.5926 }, gdl)).toBe(false);
  });
});

describe("countSearchCards", () => {
  it("counts one card per property post and one per room post", () => {
    expect(
      countSearchCards([
        { propertyPostMode: "property", propertyId: "p1" },
        { propertyPostMode: "property", propertyId: "p1" },
        { propertyPostMode: "property", propertyId: "p2" },
        { propertyPostMode: "room", propertyId: "p3" },
        { propertyPostMode: "room", propertyId: "p3" },
      ]),
    ).toBe(4);
  });
});
