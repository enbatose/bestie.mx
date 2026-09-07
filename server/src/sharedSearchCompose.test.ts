import { describe, expect, it } from "vitest";
import {
  composeSharedSearch,
  formatShareOgCaption,
  resolveSharedSearchPlacePhrase,
} from "./sharedSearchCompose.js";

describe("composeSharedSearch", () => {
  it("uses admin gender as a non-negotiable and builds an OG caption", () => {
    const composed = composeSharedSearch({
      city: "Guadalajara",
      seekerGender: "female",
      extraction: {
        budgetMin: 6000,
        budgetMax: 8000,
        neighborhoods: ["Americana"],
        pois: ["ITESO"],
      },
    });
    expect(composed.filters.pref).toBe("female");
    expect(composed.similar.seekerGender).toBe("female");
    expect(composed.filters.q).toBe("");
    expect(composed.similar.pois.some((p) => p.name === "ITESO" || p.name === "Americana")).toBe(true);
    const caption = formatShareOgCaption({
      exactCount: 4,
      similarCount: 12,
      cityAbbr: "GDL",
      priceLabel: "$6k–$8k",
      mainArea: "Americana",
    });
    expect(caption).toContain("4 en zona");
    expect(caption).toContain("12 cerca");
    expect(caption).toContain("Americana");
    expect(caption).not.toMatch(/GDL,\s*Guadalajara/);
    expect(caption.length).toBeLessThanOrEqual(90);
  });

  it("puts an unmapped street in the OG title instead of only the city", () => {
    const place = resolveSharedSearchPlacePhrase({
      neighborhoods: [],
      pois: [],
      cityAbbr: "GDL",
      cityLabel: "Guadalajara",
      label: "GDL · Av. Circunvalación División del Norte",
      zoneRule: "Área del mapa",
      insights: [
        {
          label: "Ubicación",
          text: "Cerca de Av. Circunvalación División del Norte",
          mapped: false,
        },
      ],
    });
    expect(place).toContain("Circunvalación");
    const caption = formatShareOgCaption({
      exactCount: 5,
      similarCount: 12,
      cityAbbr: "GDL",
      priceLabel: "",
      mainArea: place,
    });
    expect(caption).toContain("Circunvalación");
    expect(caption).not.toContain("Guadalajara");
    expect(caption.length).toBeLessThanOrEqual(90);
  });
});
