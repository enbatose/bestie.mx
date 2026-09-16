import { describe, expect, it } from "vitest";
import {
  applyPropertyPermitidoTags,
  propertyPermitidoTags,
  setListingTag,
  wrapListingCompoundText,
} from "@/lib/listingTags";

describe("wrapListingCompoundText", () => {
  it("lets slash compounds wrap without changing the visible label", () => {
    expect(wrapListingCompoundText("Zona Chapultepec/Americana")).toBe(
      "Zona Chapultepec/\u200BAmericana",
    );
    expect(wrapListingCompoundText("Casa Minerva Lopez")).toBe("Casa Minerva Lopez");
  });
});

describe("setListingTag", () => {
  it("adds a tag without dropping the others", () => {
    expect(setListingTag(["wifi", "muebles"], "baño-privado", true)).toEqual([
      "wifi",
      "muebles",
      "baño-privado",
    ]);
  });

  it("removes only the targeted tag", () => {
    expect(setListingTag(["estacionamiento", "muebles"], "estacionamiento", false)).toEqual([
      "muebles",
    ]);
  });
});

describe("propertyPermitidoTags", () => {
  it("keeps only the house-rule tags", () => {
    expect(propertyPermitidoTags(["wifi", "mascotas", "muebles", "fumar"])).toEqual([
      "mascotas",
      "fumar",
    ]);
  });
});

describe("applyPropertyPermitidoTags", () => {
  it("turns pets on without dropping property amenities", () => {
    expect(applyPropertyPermitidoTags(["wifi", "lavadora"], ["mascotas"])).toEqual([
      "wifi",
      "lavadora",
      "mascotas",
    ]);
  });

  it("replaces the previous permitido set", () => {
    expect(
      applyPropertyPermitidoTags(["wifi", "mascotas", "fiestas"], ["fumar"]),
    ).toEqual(["wifi", "fumar"]);
  });
});
