import { describe, expect, it } from "vitest";
import {
  combinedNeighborhoodBounds,
  computeNeighborhoodsViewport,
  metroDefaultLocation,
  neighborhoodChipLabel,
  neighborhoodNamesMatch,
  parseSearchLocation,
  searchPathForCity,
  stripMetroLabelPrefix,
  writeSearchLocation,
} from "./searchLocation";

describe("parseSearchLocation", () => {
  it("defaults to Guadalajara for /buscar", () => {
    const location = parseSearchLocation(new URLSearchParams(), null);
    expect(location.cityCode).toBe("gdl");
    expect(location.cityAbbr).toBe("GDL");
    expect(location.neighborhoods).toEqual([]);
  });

  it("reads neighborhood from nbh query param", () => {
    const params = new URLSearchParams("nbh=Colonia+Americana&lat=20.67&lng=-103.35&z=14");
    const location = parseSearchLocation(params, "gdl");
    expect(location.neighborhoods).toEqual([
      { name: "Colonia Americana", lat: 20.67, lng: -103.35 },
    ]);
    expect(location.cityCode).toBe("gdl");
  });

  it("reads multiple neighborhoods with nbhPts", () => {
    const params = new URLSearchParams(
      "nbh=Chapalita,Colonia+Americana&nbhPts=20.66,-103.39;20.67,-103.35&lat=20.665&lng=-103.37&z=12",
    );
    const location = parseSearchLocation(params, "gdl");
    expect(location.neighborhoods).toEqual([
      { name: "Chapalita", lat: 20.66, lng: -103.39 },
      { name: "Colonia Americana", lat: 20.67, lng: -103.35 },
    ]);
  });

  it("resolves route city code", () => {
    const location = parseSearchLocation(new URLSearchParams(), "gdl");
    expect(location.cityAbbr).toBe("GDL");
  });
});

describe("writeSearchLocation", () => {
  it("writes nbh and map coords", () => {
    const params = writeSearchLocation(new URLSearchParams(), {
      ...metroDefaultLocation(),
      neighborhoods: [{ name: "Chapalita", lat: 20.66, lng: -103.39 }],
      lat: 20.66,
      lng: -103.39,
      zoom: 14,
    });
    expect(params.get("nbh")).toBe("Chapalita");
    expect(params.get("nbhPts")).toBe("20.66,-103.39");
    expect(params.get("lat")).toBe("20.66");
    expect(params.get("loc")).toBeNull();
  });

  it("writes multiple neighborhoods", () => {
    const params = writeSearchLocation(new URLSearchParams(), {
      ...metroDefaultLocation(),
      neighborhoods: [
        { name: "Chapalita", lat: 20.66, lng: -103.39 },
        { name: "Americana", lat: 20.67, lng: -103.35 },
      ],
      lat: 20.665,
      lng: -103.37,
      zoom: 12,
    });
    expect(params.get("nbh")).toBe("Chapalita,Americana");
    expect(params.get("nbhPts")).toBe("20.66,-103.39;20.67,-103.35");
  });
});

describe("stripMetroLabelPrefix", () => {
  it("removes GDL prefix from neighborhood labels", () => {
    expect(stripMetroLabelPrefix("GDL", "GDL - Colonia Americana")).toBe("Colonia Americana");
    expect(stripMetroLabelPrefix("GDL", "Colonia Americana")).toBe("Colonia Americana");
  });
});

describe("neighborhoodChipLabel", () => {
  it("returns neighborhood without metro prefix", () => {
    expect(neighborhoodChipLabel("GDL - Chapalita", "GDL")).toBe("Chapalita");
  });
});

describe("neighborhoodNamesMatch", () => {
  it("matches case-insensitively", () => {
    expect(neighborhoodNamesMatch("Chapalita", "chapalita")).toBe(true);
    expect(neighborhoodNamesMatch("Chapalita", "Americana")).toBe(false);
  });
});

describe("combinedNeighborhoodBounds", () => {
  it("expands each pin to a neighborhood-sized box", () => {
    const bounds = combinedNeighborhoodBounds([{ name: "Chapalita", lat: 20.66, lng: -103.39 }]);
    expect(bounds).not.toBeNull();
    expect(bounds!.maxLat - bounds!.minLat).toBeGreaterThan(0.015);
    expect(bounds!.maxLat - bounds!.minLat).toBeLessThan(0.025);
  });
});

describe("computeNeighborhoodsViewport", () => {
  it("zooms out for multiple neighborhoods", () => {
    const single = computeNeighborhoodsViewport([
      { name: "Chapalita", lat: 20.66, lng: -103.39 },
    ]);
    const multi = computeNeighborhoodsViewport([
      { name: "Chapalita", lat: 20.66, lng: -103.39 },
      { name: "Americana", lat: 20.74, lng: -103.31 },
    ]);
    expect(single.zoom).toBe(14);
    expect(multi.zoom).toBeLessThan(single.zoom);
    expect(multi.zoom).toBeGreaterThanOrEqual(12);
  });

  it("keeps nearby neighborhoods at a street-level zoom", () => {
    const viewport = computeNeighborhoodsViewport([
      { name: "Colonia Americana", lat: 20.6739, lng: -103.362 },
      { name: "Centro Histórico", lat: 20.6772, lng: -103.3472 },
    ]);
    expect(viewport.zoom).toBeGreaterThanOrEqual(13);
  });

  it("does not zoom out two levels for nearby west Guadalajara neighborhoods", () => {
    const viewport = computeNeighborhoodsViewport([
      { name: "Arcos Vallarta", lat: 20.6724, lng: -103.3796 },
      { name: "Colonia Americana", lat: 20.67459, lng: -103.35943 },
    ]);
    expect(viewport.zoom).toBeGreaterThan(12);
  });
});

describe("searchPathForCity", () => {
  it("builds metro path", () => {
    expect(searchPathForCity("gdl")).toBe("/buscar/gdl");
  });
});
