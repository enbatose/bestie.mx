import { describe, expect, it } from "vitest";
import {
  defaultSimilarConfig,
  haversineKm,
  matchExactSharedSearch,
  matchSimilarSharedSearch,
  passesGenderNonNegotiable,
  recoverPinsFromPlacePhrases,
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

  it("excludes singles-only rooms when the seeker asked for two people", () => {
    const emptyHoods = { ...location, neighborhoods: [] as typeof location.neighborhoods };
    const recovered = recoverPinsFromPlacePhrases(
      { ...location, neighborhoods: [{ name: "Centro", lat: 20.6751, lng: -103.3473 }] },
      defaultSimilarConfig({ pois: [{ name: "Centro", lat: 20.6751, lng: -103.3473 }] }),
      ["para dos personas"],
      "gdl",
    );
    expect(recovered.similar.excludedTags).toContain("individuos-solo");
    const coupleOk = listing({ id: "ok", lat: 20.676, lng: -103.348, tags: ["muebles"] });
    const singles = listing({ id: "solo", lat: 20.676, lng: -103.348, tags: ["individuos-solo"] });
    const far = listing({ id: "far", lat: 20.55, lng: -103.45, neighborhood: "Aeropuerto", tags: ["muebles"] });
    const split = splitSharedSearchMatches(
      [coupleOk, singles, far],
      EMPTY_SEARCH_FILTERS,
      recovered.location,
      recovered.similar,
    );
    expect(split.exact.map((l) => l.id)).toEqual(["ok"]);
    expect(split.similar.map((r) => r.listing.id)).not.toContain("far");
    expect(split.similar.map((r) => r.listing.id)).not.toContain("solo");
  });

  it("resolves Tianguis del Sol without confusing it with Plaza del Sol", () => {
    const tianguis = resolvePlacePins(["GDL · Tianguis del Sol"]);
    expect(tianguis.map((p) => p.name)).toEqual(["Tianguis del Sol"]);
    const plaza = resolvePlacePins(["cerca de Plaza del Sol"]);
    expect(plaza.map((p) => p.name)).toEqual(["Plaza del Sol"]);
    const both = resolvePlacePins(["cerca del ITESO y UVM"]);
    expect(both.map((p) => p.name)).toEqual(["ITESO", "UVM"]);
  });

  it("recovers a named landmark from the share label and does not city-match an unknown place", () => {
    const emptyHoods = { ...location, neighborhoods: [] as typeof location.neighborhoods };
    const recovered = recoverPinsFromPlacePhrases(
      emptyHoods,
      defaultSimilarConfig(),
      ["GDL · Tianguis del Sol"],
      "gdl",
    );
    expect(recovered.recovered).toBe(true);
    expect(recovered.similar.pois[0]?.name).toBe("Tianguis del Sol");
    expect(recovered.location.lat).toBeCloseTo(20.65209, 4);

    const missing = recoverPinsFromPlacePhrases(
      emptyHoods,
      defaultSimilarConfig(),
      ["GDL · Fraccionamiento Inventado"],
      "gdl",
    );
    expect(missing.recovered).toBe(false);
    expect(missing.similar.unresolvedPlace).toBe(true);
    const cityWide = listing({ id: "anywhere", lat: 20.53, lng: -103.43, neighborhood: "Vista Sur" });
    expect(
      matchExactSharedSearch([cityWide], EMPTY_SEARCH_FILTERS, missing.location, missing.similar),
    ).toEqual([]);
    expect(
      matchSimilarSharedSearch([cityWide], EMPTY_SEARCH_FILTERS, missing.similar, new Set()),
    ).toEqual([]);
  });

  it("resolves Glorieta del Charro and does not treat the whole city as en zona", () => {
    const pins = resolvePlacePins(["Glorieta del Charro"]);
    expect(pins.some((p) => p.name === "Glorieta del Charro")).toBe(true);
    const emptyHoods = { ...location, neighborhoods: [] as typeof location.neighborhoods };
    const recovered = recoverPinsFromPlacePhrases(
      emptyHoods,
      defaultSimilarConfig(),
      ["GDL · Glorieta del Charro"],
      "gdl",
    );
    expect(recovered.recovered).toBe(true);
    expect(recovered.similar.pois[0]?.name).toBe("Glorieta del Charro");
    const near = listing({ id: "near", lat: 20.65, lng: -103.308, neighborhood: "San Rafael" });
    const far = listing({ id: "far", lat: 20.5333, lng: -103.4333, neighborhood: "Vista Sur" });
    const exact = matchExactSharedSearch(
      [near, far],
      EMPTY_SEARCH_FILTERS,
      recovered.location,
      recovered.similar,
    );
    expect(exact.map((l) => l.id)).toEqual(["near"]);
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
