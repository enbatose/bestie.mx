import { describe, expect, it } from "vitest";
import {
  buildListingSearchIndex,
  cityAliasKey,
  listingMatchesQuery,
  parseMyListingsQuery,
} from "./myListingsSearch";
import type { PropertyListing } from "../types/listing";

function room(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    id: "1111aaaa-2222-3333-4444-555566667777",
    propertyId: "prp__9999bbbb-1111-2222-3333-444455556666",
    propertyTitle: "Casa amplia en Mezquitán Country",
    title: "Recámara 1",
    roomCustomName: "Recámara con balcón",
    summary: "Cuarto luminoso con clóset grande y baño privado.",
    neighborhood: "Providencia",
    city: "Guadalajara",
    lat: 20.7,
    lng: -103.4,
    rentMxn: 4800,
    roomsAvailable: 1,
    tags: [],
    roommateGenderPref: "any",
    ageMin: 22,
    ageMax: 35,
    contactWhatsApp: "",
    ...overrides,
  };
}

function matches(query: string, rooms: PropertyListing[] = [room()]): boolean {
  return listingMatchesQuery(buildListingSearchIndex(rooms), parseMyListingsQuery(query));
}

describe("cityAliasKey", () => {
  it("maps abbreviations and full names to the same key", () => {
    expect(cityAliasKey("GDL")).toBe("gdl");
    expect(cityAliasKey("Guadalajara")).toBe("gdl");
    expect(cityAliasKey("ZMG")).toBe("gdl");
  });

  it("maps the many spellings of Ciudad de México", () => {
    expect(cityAliasKey("CDMX")).toBe("cmx");
    expect(cityAliasKey("Ciudad de México")).toBe("cmx");
    expect(cityAliasKey("DF")).toBe("cmx");
  });

  it("returns null for text that is not a city", () => {
    expect(cityAliasKey("recámara")).toBeNull();
    expect(cityAliasKey("")).toBeNull();
  });
});

describe("listingMatchesQuery", () => {
  it("matches an empty query", () => {
    expect(matches("")).toBe(true);
  });

  it("matches title, description, neighborhood and city", () => {
    expect(matches("mezquitan")).toBe(true);
    expect(matches("balcón")).toBe(true);
    expect(matches("luminoso")).toBe(true);
    expect(matches("providencia")).toBe(true);
    expect(matches("guadalajara")).toBe(true);
  });

  it("ignores accents and tolerates typos", () => {
    expect(matches("Mezquitán")).toBe(true);
    expect(matches("mesquitan")).toBe(true);
    expect(matches("providensia")).toBe(true);
  });

  it("matches city abbreviations against the full name", () => {
    expect(matches("GDL")).toBe(true);
    expect(matches("ZMG")).toBe(true);
    expect(matches("CDMX")).toBe(false);
  });

  it("matches rent written in any format", () => {
    for (const q of ["4800", "4,800", "$4,800", "4.800", "4.8k", "$4800/mes", "renta 4800 mxn"]) {
      expect(matches(q), q).toBe(true);
    }
  });

  it("treats nearby amounts as the same rent", () => {
    expect(matches("5 mil")).toBe(true);
    expect(matches("5000")).toBe(true);
    expect(matches("9000")).toBe(false);
  });

  it("supports rent ranges", () => {
    expect(matches("menos de 5000")).toBe(true);
    expect(matches("hasta 4000")).toBe(false);
    expect(matches("más de 4000")).toBe(true);
    expect(matches("más de 6000")).toBe(false);
  });

  it("requires every term to match", () => {
    expect(matches("casa amplia gdl")).toBe(true);
    expect(matches("casa amplia cdmx")).toBe(false);
  });

  it("searches across all rooms of a property", () => {
    const rooms = [
      room(),
      room({ id: "2222bbbb-3333-4444-5555-666677778888", roomCustomName: "Estudio azotea", rentMxn: 6200 }),
    ];
    expect(matches("azotea", rooms)).toBe(true);
    expect(matches("6200", rooms)).toBe(true);
  });
});

describe("parseMyListingsQuery", () => {
  it("drops filler words so they do not narrow results", () => {
    expect(parseMyListingsQuery("casa de la colonia").terms).toEqual([
      { kind: "text", token: "casa" },
      { kind: "text", token: "colonia" },
    ]);
  });

  it("reads comparators into rent terms", () => {
    expect(parseMyListingsQuery("hasta 6 mil").terms).toEqual([
      { kind: "rent", value: 6000, op: "lte" },
    ]);
  });
});
