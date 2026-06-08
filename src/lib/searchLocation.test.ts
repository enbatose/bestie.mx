import { describe, expect, it } from "vitest";
import {
  metroDefaultLocation,
  neighborhoodChipLabel,
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
    expect(location.neighborhood).toBeNull();
  });

  it("reads neighborhood from nbh query param", () => {
    const params = new URLSearchParams("nbh=Colonia+Americana&lat=20.67&lng=-103.35&z=14");
    const location = parseSearchLocation(params, "gdl");
    expect(location.neighborhood).toBe("Colonia Americana");
    expect(location.cityCode).toBe("gdl");
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
      neighborhood: "Chapalita",
      lat: 20.66,
      lng: -103.39,
      zoom: 14,
    });
    expect(params.get("nbh")).toBe("Chapalita");
    expect(params.get("lat")).toBe("20.66");
    expect(params.get("loc")).toBeNull();
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
    const location = {
      ...metroDefaultLocation(),
      neighborhood: "GDL - Chapalita",
    };
    expect(neighborhoodChipLabel(location)).toBe("Chapalita");
  });
});

describe("searchPathForCity", () => {
  it("builds metro path", () => {
    expect(searchPathForCity("gdl")).toBe("/buscar/gdl");
  });
});
