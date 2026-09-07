import { describe, expect, it } from "vitest";
import {
  areaNamesForSavedSearchCard,
  resolveSavedSearchMatches,
  type SavedSearchLocationSnapshot,
} from "./savedSearchMatch.js";
import { defaultSimilarConfig, EMPTY_SEARCH_FILTERS } from "./sharedSearchMatch.js";
import type { PropertyListing } from "./types.js";

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
  createdAt: "2026-09-06T12:00:00.000Z",
  ...over,
});

const chapuLocation: SavedSearchLocationSnapshot = {
  cityCode: "gdl",
  cityLabel: "Guadalajara",
  neighborhoods: [],
  lat: 20.6746,
  lng: -103.3665,
  zoom: 14,
};

describe("resolveSavedSearchMatches", () => {
  it("does not treat campaign shares with empty neighborhoods as city-wide", () => {
    const inZone = listing({ id: "in", neighborhood: "Colonia Americana" });
    const far = listing({
      id: "far",
      neighborhood: "Vista Sur Residencial",
      lat: 20.53,
      lng: -103.45,
    });
    const similarJson = JSON.stringify(
      defaultSimilarConfig({
        pois: [{ name: "Zona Chapultepec/Americana", lat: 20.6746, lng: -103.3665 }],
        bbox: {
          minLat: 20.643159108875317,
          maxLat: 20.706040891124687,
          minLng: -103.40010503382537,
          maxLng: -103.33289496617463,
        },
        radiusKm: 3.5,
      }),
    );
    const { exact } = resolveSavedSearchMatches(
      [inZone, far],
      EMPTY_SEARCH_FILTERS,
      chapuLocation,
      similarJson,
    );
    expect(exact.map((l) => l.id)).toEqual(["in"]);
  });

  it("without similar_json, empty neighborhoods still follow filters only", () => {
    const a = listing({ id: "a" });
    const b = listing({
      id: "b",
      neighborhood: "Tlajomulco",
      lat: 20.47,
      lng: -103.44,
    });
    const { exact } = resolveSavedSearchMatches([a, b], EMPTY_SEARCH_FILTERS, chapuLocation, null);
    expect(exact.map((l) => l.id).sort()).toEqual(["a", "b"]);
  });
});

describe("areaNamesForSavedSearchCard", () => {
  it("uses campaign POI name when neighborhoods are empty", () => {
    const similarJson = JSON.stringify(
      defaultSimilarConfig({
        pois: [{ name: "Zona Chapultepec/Americana", lat: 20.6746, lng: -103.3665 }],
        bbox: {
          minLat: 20.643,
          maxLat: 20.706,
          minLng: -103.4,
          maxLng: -103.333,
        },
      }),
    );
    expect(areaNamesForSavedSearchCard(EMPTY_SEARCH_FILTERS, chapuLocation, [], similarJson)).toEqual([
      "Zona Chapultepec/Americana",
    ]);
  });
});
