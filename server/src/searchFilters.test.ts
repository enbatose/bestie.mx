import { describe, expect, it } from "vitest";
import { filterListings, parseBboxParam, parseFilters } from "./searchFilters.js";
import type { PropertyListing } from "./types.js";

const baseListing = (over: Partial<PropertyListing>): PropertyListing => ({
  id: "t1",
  title: "Test",
  city: "Guadalajara",
  neighborhood: "Centro",
  lat: 20.67,
  lng: -103.35,
  rentMxn: 4000,
  roomsAvailable: 1,
  tags: [],
  roommateGenderPref: "any",
  ageMin: 18,
  ageMax: 99,
  summary: "x",
  contactWhatsApp: "52",
  status: "published",
  ...over,
});

describe("parseBboxParam", () => {
  it("parses valid bbox", () => {
    expect(parseBboxParam("19, -100, 21, -99")).toEqual({
      minLat: 19,
      minLng: -100,
      maxLat: 21,
      maxLng: -99,
    });
  });

  it("rejects invalid ordering", () => {
    expect(parseBboxParam("21,-99,19,-100")).toBeNull();
  });
});

describe("filterListings + bbox", () => {
  it("filters by bbox", () => {
    const rows = [
      baseListing({ id: "in", lat: 20.5, lng: -103.0 }),
      baseListing({ id: "out", lat: 25.0, lng: -103.0 }),
    ];
    const f = parseFilters(
      new URLSearchParams({ bbox: "20, -104, 21, -102" }),
    );
    const out = filterListings(rows, f);
    expect(out.map((r) => r.id)).toEqual(["in"]);
  });
});
