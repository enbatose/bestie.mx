import { describe, expect, it } from "vitest";
import { DEFAULT_METRO_CITY } from "./metroCities.js";
import {
  buildCuratedNeighborhoodSuggestions,
  buildStreetLabel,
  dedupePublishSuggestions,
  mergeLocationSuggestions,
  municipalitySortRank,
  parseHouseNumberFromQuery,
  sortPublishSuggestions,
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

describe("parseHouseNumberFromQuery", () => {
  it("reads a trailing Mexican house number", () => {
    expect(parseHouseNumberFromQuery("Av Mexico 2582")).toBe("2582");
    expect(parseHouseNumberFromQuery("Avenida México #2582")).toBe("2582");
    expect(parseHouseNumberFromQuery("Calle Marsella 42-A")).toBe("42-A");
  });

  it("ignores 5-digit postcodes and queries without a number", () => {
    expect(parseHouseNumberFromQuery("Av Mexico 44690")).toBeNull();
    expect(parseHouseNumberFromQuery("San Demetrio")).toBeNull();
  });
});

describe("buildStreetLabel", () => {
  it("keeps the typed house number when OSM only returns the road", () => {
    const result = buildStreetLabel(
      {
        road: "Avenida México",
        quarter: "Arcos Vallarta",
        city: "Guadalajara",
        residential: "Municipio de Guadalajara",
      },
      DEFAULT_METRO_CITY,
      "2582",
    );
    expect(result.streetAddress).toBe("Avenida México 2582");
    expect(result.neighborhood).toBe("Arcos Vallarta");
  });

  it("does not treat Municipio de Guadalajara as a colonia", () => {
    const result = buildStreetLabel(
      {
        road: "Avenida México",
        residential: "Municipio de Guadalajara",
        city: "Zapopan",
      },
      DEFAULT_METRO_CITY,
    );
    expect(result.neighborhood).toBeNull();
    expect(result.streetAddress).toBe("Avenida México");
  });
});

describe("publish suggestion ranking and dedupe", () => {
  it("ranks Guadalajara and Zapopan ahead of other ZMG municipalities", () => {
    expect(municipalitySortRank("Guadalajara")).toBeLessThan(municipalitySortRank("Zapopan"));
    expect(municipalitySortRank("Zapopan")).toBeLessThan(municipalitySortRank("Tlajomulco de Zúñiga"));
    expect(municipalitySortRank("El Salto")).toBeGreaterThan(municipalitySortRank("Zapopan"));
  });

  it("collapses Av México in Arcos Vallarta across Guadalajara and Zapopan", () => {
    const result = dedupePublishSuggestions([
      {
        key: "zap",
        label: "Avenida México, Arcos Vallarta — GDL",
        value: "Avenida México, Arcos Vallarta — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Zapopan",
        neighborhood: "Arcos Vallarta",
        lat: 20.6794471,
        lng: -103.3840303,
        zoom: 17,
        streetAddress: "Avenida México 2582",
        score: 400,
      },
      {
        key: "gdl",
        label: "Avenida México, Arcos Vallarta — GDL",
        value: "Avenida México, Arcos Vallarta — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: "Arcos Vallarta",
        lat: 20.6793619,
        lng: -103.3811592,
        zoom: 17,
        streetAddress: "Avenida México 2582",
        score: 400,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.city).toBe("Guadalajara");
  });

  it("keeps distant same-name streets and lists Zapopan before outer municipalities", () => {
    const sorted = sortPublishSuggestions([
      {
        key: "salto",
        label: "San Demetrio — GDL",
        value: "San Demetrio — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "El Salto",
        neighborhood: null,
        lat: 20.5634696,
        lng: -103.2047265,
        zoom: 17,
        streetAddress: "San Demetrio",
        score: 900,
      },
      {
        key: "tlaj",
        label: "San Demetrio — GDL",
        value: "San Demetrio — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Tlajomulco de Zúñiga",
        neighborhood: "Fraccionamiento Real del Valle",
        lat: 20.5464649,
        lng: -103.3666993,
        zoom: 17,
        streetAddress: "San Demetrio",
        score: 900,
      },
      {
        key: "zap",
        label: "Calle San Demetrio — GDL",
        value: "Calle San Demetrio — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Zapopan",
        neighborhood: "Jardines de San Ignacio",
        lat: 20.670006,
        lng: -103.4065262,
        zoom: 17,
        streetAddress: "Calle San Demetrio",
        score: 500,
      },
    ]);
    expect(sorted.map((item) => item.city)).toEqual([
      "Zapopan",
      "Tlajomulco de Zúñiga",
      "El Salto",
    ]);
  });

  it("collapses Av México 2582 OSM segments into one result", () => {
    const result = dedupePublishSuggestions([
      {
        key: "gdl-a",
        label: "Avenida México 2582 — GDL",
        value: "Avenida México 2582 — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: null,
        lat: 20.679,
        lng: -103.3708,
        zoom: 17,
        streetAddress: "Avenida México 2582",
        score: 400,
      },
      {
        key: "gdl-b",
        label: "Avenida México 2582 — GDL",
        value: "Avenida México 2582 — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Guadalajara",
        neighborhood: null,
        lat: 20.67936,
        lng: -103.3767,
        zoom: 17,
        streetAddress: "Avenida México 2582",
        score: 400,
      },
      {
        key: "zap",
        label: "Avenida México 2582 — GDL",
        value: "Avenida México 2582 — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Zapopan",
        neighborhood: null,
        lat: 20.67952,
        lng: -103.39014,
        zoom: 17,
        streetAddress: "Avenida México 2582",
        score: 400,
      },
      {
        key: "bosco",
        label: "Avenida México 2582, Don Bosco Vallarta — GDL",
        value: "Avenida México 2582, Don Bosco Vallarta — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Zapopan",
        neighborhood: "Don Bosco Vallarta",
        lat: 20.6789,
        lng: -103.3951,
        zoom: 17,
        streetAddress: "Avenida México 2582",
        score: 400,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.neighborhood).toBe("Don Bosco Vallarta");
    expect(result[0]?.city).toBe("Zapopan");
  });

  it("merges two nearby San Demetrio hits in the same municipality", () => {
    const result = dedupePublishSuggestions([
      {
        key: "a",
        label: "San Demetrio — GDL",
        value: "San Demetrio — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Tlajomulco de Zúñiga",
        neighborhood: "Fraccionamiento Real del Valle",
        lat: 20.5464649,
        lng: -103.3666993,
        zoom: 17,
        streetAddress: "San Demetrio",
        score: 800,
      },
      {
        key: "b",
        label: "San Demetrio — GDL",
        value: "San Demetrio — GDL",
        kind: "address",
        cityCode: "gdl",
        city: "Tlajomulco de Zúñiga",
        neighborhood: "Fraccionamiento Real del Valle",
        lat: 20.5468,
        lng: -103.3669,
        zoom: 17,
        streetAddress: "San Demetrio",
        score: 700,
      },
    ]);
    expect(result).toHaveLength(1);
  });
});

