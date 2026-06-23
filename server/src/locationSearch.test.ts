import { describe, expect, it } from "vitest";
import { DEFAULT_METRO_CITY } from "./metroCities.js";
import {
  buildCuratedNeighborhoodSuggestions,
  mergeLocationSuggestions,
  suggestionDedupeKey,
} from "./locationSearch.js";

describe("suggestionDedupeKey", () => {
  it("maps Americana alias to Colonia Americana", () => {
    expect(suggestionDedupeKey("Americana", "Guadalajara")).toBe("colonia americana");
    expect(suggestionDedupeKey("Colonia Americana", "Guadalajara")).toBe("colonia americana");
  });

  it("maps Centro alias to Centro Histórico", () => {
    expect(suggestionDedupeKey("Centro", "Guadalajara")).toBe("centro historico");
  });

  it("keeps unknown neighborhoods distinct", () => {
    expect(suggestionDedupeKey("Vallarta Poniente", "Guadalajara")).toBe("vallarta poniente");
  });
});

describe("mergeLocationSuggestions", () => {
  it("collapses Americana and Colonia Americana into one curated label", () => {
    const curated = [
      {
        key: "curated:Colonia Americana",
        label: "GDL - Colonia Americana",
        value: "GDL - Colonia Americana",
        kind: "neighborhood" as const,
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: "Colonia Americana",
        lat: 20.67459,
        lng: -103.35943,
        zoom: 14,
        score: 850,
      },
    ];
    const nominatim = [
      {
        key: "GDL - Americana:20.67:-103.36",
        label: "GDL - Americana",
        value: "GDL - Americana",
        kind: "neighborhood" as const,
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: "Americana",
        lat: 20.674,
        lng: -103.359,
        zoom: 14,
        score: 1000,
      },
    ];

    const result = mergeLocationSuggestions(curated, nominatim);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("GDL - Colonia Americana");
  });

  it("still dedupes identical labels from nominatim", () => {
    const nominatim = [
      {
        key: "a",
        label: "GDL - Chapalita",
        value: "GDL - Chapalita",
        kind: "neighborhood" as const,
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: "Chapalita",
        lat: 20.664,
        lng: -103.396,
        zoom: 14,
        score: 500,
      },
      {
        key: "b",
        label: "GDL - Chapalita",
        value: "GDL - Chapalita",
        kind: "neighborhood" as const,
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: "Chapalita",
        lat: 20.665,
        lng: -103.397,
        zoom: 14,
        score: 400,
      },
    ];

    const result = mergeLocationSuggestions([], nominatim);
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("GDL - Chapalita");
  });
});

describe("buildCuratedNeighborhoodSuggestions", () => {
  it("includes Valle Real for Valle searches", () => {
    const result = buildCuratedNeighborhoodSuggestions("Valle", DEFAULT_METRO_CITY);
    expect(result.some((item) => item.neighborhood === "Valle Real")).toBe(true);
  });
});
