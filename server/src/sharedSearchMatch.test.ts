import { describe, expect, it } from "vitest";
import {
  defaultSimilarConfig,
  haversineKm,
  matchExactSharedSearch,
  matchSimilarSharedSearch,
  passesGenderNonNegotiable,
  resolvePlacePins,
  splitSharedSearchMatches,
  EMPTY_SEARCH_FILTERS,
} from "./sharedSearchMatch.js";
import type { PropertyListing } from "./types.js";
import type { SavedSearchLocationSnapshot } from "./savedSearchMatch.js";

const listing = (over: Partial<PropertyListing>): PropertyListing => ({
  id: "t1",
  propertyId: "prp__t1",
  title: "Test",
  city: "Guadalajara",
  neighborhood: "Americana",
  lat: 20.6746,
  lng: -103.3665,
  rentMxn: 7000,
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

const location: SavedSearchLocationSnapshot = {
  cityCode: "gdl",
  cityLabel: "Guadalajara",
  neighborhoods: [{ name: "Americana", lat: 20.6746, lng: -103.3665 }],
  lat: 20.6746,
  lng: -103.3665,
  zoom: 14,
};

describe("shared search matching", () => {
  it("resolves ITESO as a POI pin", () => {
    const pins = resolvePlacePins(["cerca del ITESO"]);
    expect(pins.some((p) => p.name === "ITESO")).toBe(true);
  });

  it("excludes men-only listings for a woman seeker", () => {
    const womanOk = listing({ id: "w", roommateGenderPref: "female" });
    const menOnly = listing({ id: "m", roommateGenderPref: "male" });
    const mixed = listing({ id: "a", roommateGenderPref: "any" });
    expect(passesGenderNonNegotiable(womanOk, "female")).toBe(true);
    expect(passesGenderNonNegotiable(mixed, "female")).toBe(true);
    expect(passesGenderNonNegotiable(menOnly, "female")).toBe(false);
  });

  it("treats same-colonia listings in budget as exact", () => {
    const rows = [
      listing({ id: "exact", neighborhood: "Americana", rentMxn: 7000 }),
      listing({ id: "far", neighborhood: "Tonalá", lat: 20.624, lng: -103.242, rentMxn: 7000 }),
    ];
    const filters = { ...EMPTY_SEARCH_FILTERS, budgetMin: 6000, budgetMax: 8000, pref: "female" as const };
    const exact = matchExactSharedSearch(rows, filters, location, defaultSimilarConfig({ seekerGender: "female" }));
    expect(exact.map((l) => l.id)).toEqual(["exact"]);
  });

  it("ranks nearby price-band listings as similar and includes no-price posts", () => {
    const americana = listing({ id: "near", rentMxn: 8500 });
    const noPrice = listing({ id: "hidden", rentMxn: 0, hidePricing: true });
    const far = listing({
      id: "far",
      neighborhood: "Tonalá",
      lat: 20.624,
      lng: -103.242,
      rentMxn: 8500,
    });
    const menOnly = listing({ id: "men", roommateGenderPref: "male", rentMxn: 7000 });
    const split = splitSharedSearchMatches(
      [americana, noPrice, far, menOnly],
      { ...EMPTY_SEARCH_FILTERS, budgetMin: 6000, budgetMax: 8000, pref: "female" },
      location,
      defaultSimilarConfig({
        seekerGender: "female",
        pois: [{ name: "Americana", lat: 20.6746, lng: -103.3665 }],
      }),
    );
    expect(split.similar.map((r) => r.listing.id)).toContain("near");
    expect(split.similar.map((r) => r.listing.id)).toContain("hidden");
    expect(split.similar.map((r) => r.listing.id)).not.toContain("men");
  });

  it("does not fill similares with city-wide inventory", () => {
    const far = listing({
      id: "only",
      neighborhood: "El Salto",
      lat: 20.52,
      lng: -103.18,
      rentMxn: 12000,
    });
    const similar = matchSimilarSharedSearch(
      [far],
      { ...EMPTY_SEARCH_FILTERS, budgetMax: 5000 },
      defaultSimilarConfig({
        pois: [{ name: "Americana", lat: 20.6746, lng: -103.3665 }],
      }),
      new Set(),
    );
    expect(similar).toHaveLength(0);
  });

  it("does not resolve GDL POIs for other cities", () => {
    expect(resolvePlacePins(["ITESO"], "poi", "mty")).toEqual([]);
    expect(resolvePlacePins(["cerca del ITESO"], "poi", "gdl").some((p) => p.name === "ITESO")).toBe(true);
  });

  it("prefers POI disk over campaign bbox for exact matches", () => {
    const emptyHoods = { ...location, neighborhoods: [] as typeof location.neighborhoods };
    const inDisk = listing({ id: "in", lat: 20.6746, lng: -103.3665 });
    // Inside the ~3.5 km square bbox corner, but outside the 3.5 km circle.
    const cornerOnly = listing({
      id: "corner",
      neighborhood: "Huerta Baeza",
      lat: 20.6585,
      lng: -103.3352,
    });
    const cfg = defaultSimilarConfig({
      pois: [{ name: "Zona Chapultepec/Americana", lat: 20.6746, lng: -103.3665 }],
      bbox: {
        minLat: 20.643159108875317,
        maxLat: 20.706040891124687,
        minLng: -103.40010503382537,
        maxLng: -103.33289496617463,
      },
    });
    const exact = matchExactSharedSearch([inDisk, cornerOnly], EMPTY_SEARCH_FILTERS, emptyHoods, cfg);
    expect(exact.map((l) => l.id)).toEqual(["in"]);
  });

  it("haversine is ~0 for the same point", () => {
    expect(haversineKm(20.67, -103.35, 20.67, -103.35)).toBeLessThan(0.01);
  });
});
