import { describe, expect, it } from "vitest";
import { composeSharedSearch, formatShareOgCaption } from "./sharedSearchCompose.js";

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
    expect(caption).toContain("4 exactas");
    expect(caption.length).toBeLessThanOrEqual(90);
  });
});
