import { describe, expect, it } from "vitest";
import {
  composeSharedSearch,
  dropMealPlanUtilityTag,
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

  it("does not treat a weekly meal plan as included utilities", () => {
    expect(dropMealPlanUtilityTag(["servicios-incluidos"], ["plan de alimentación semanal"])).toEqual([]);
    const composed = composeSharedSearch({
      city: "Guadalajara",
      seekerGender: "female",
      extraction: {
        pois: ["Lamar Palomar"],
        requiredTags: ["servicios-incluidos"],
        unmappedCriteria: [{ label: "alimentación", text: "plan de alimentación en la semana" }],
      },
    });
    expect(composed.similar.requiredTags).not.toContain("servicios-incluidos");
    expect(composed.similar.pois.some((p) => p.name === "Universidad Lamar")).toBe(true);
  });

  it("names every requested zone, not only the first pin", () => {
    const place = resolveSharedSearchPlacePhrase({
      neighborhoods: [
        { name: "Centro" },
        { name: "Tonalá" },
        { name: "Tlaquepaque" },
      ],
      pois: [],
      cityAbbr: "GDL",
      cityLabel: "Guadalajara",
      label: "GDL · Centro",
      zoneRule: "Centro, Tonalá, Tlaquepaque · 3.5 km de Centro",
    });
    expect(place).toBe("Centro, Tonalá o Tlaquepaque");
  });

  it("does not let city-only zoneRule hide Plaza Patria from the share label", () => {
    const place = resolveSharedSearchPlacePhrase({
      neighborhoods: [],
      pois: [],
      cityAbbr: "GDL",
      cityLabel: "Guadalajara",
      label: "GDL · $5–5k · Plaza Patria",
      zoneRule: "Guadalajara",
      insights: [],
    });
    expect(place).toBe("Plaza Patria");
    const caption = formatShareOgCaption({
      exactCount: 1,
      similarCount: 0,
      cityAbbr: "GDL",
      cityLabel: "Guadalajara",
      priceLabel: "$5k–$5k",
      mainArea: place,
    });
    expect(caption).toContain("Plaza Patria");
    expect(caption).toMatch(/1 en zona/);
    expect(caption).not.toContain("Guadalajara");
    expect(caption.length).toBeLessThanOrEqual(90);
  });
});
