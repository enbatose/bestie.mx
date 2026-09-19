import { describe, expect, it } from "vitest";
import {
  CHAT_AMENITY_OPTIONS,
  chatAmenityConfirmEligible,
  chatAmenityMenuText,
  chatAmenityRemoveMenuText,
  chatAmenitySelected,
  parseChatAmenityRemoveReply,
  parseChatAmenityReply,
} from "./chatPublishAmenities.js";

describe("chatPublishAmenities", () => {
  it("keeps the chat menu to six filter-aligned options", () => {
    expect(CHAT_AMENITY_OPTIONS).toHaveLength(6);
    expect(CHAT_AMENITY_OPTIONS.map((o) => o.slug)).toEqual([
      "wifi",
      "muebles",
      "baño-privado",
      "estacionamiento",
      "mascotas",
      "lavadora",
    ]);
  });

  it("confirm-first when at least two menu tags are already known", () => {
    expect(chatAmenityConfirmEligible(["wifi"])).toBe(false);
    expect(chatAmenityConfirmEligible(["wifi", "mascotas"])).toBe(true);
    expect(chatAmenityConfirmEligible(["closet", "agua-caliente"])).toBe(false);
  });

  it("lists only missing amenities with stable numbers", () => {
    const text = chatAmenityMenuText(["wifi", "baño-privado"], { onlyMissing: true });
    expect(text).toContain("2. Amueblado");
    expect(text).toContain("4. Estacionamiento");
    expect(text).not.toContain("1. Wifi");
    expect(text).not.toContain("3. Baño privado");
  });

  it("parses add and remove replies", () => {
    expect(parseChatAmenityReply("1, 4 y 5")).toEqual(["wifi", "estacionamiento", "mascotas"]);
    const selected = chatAmenitySelected(["wifi", "mascotas", "lavadora"]);
    expect(selected.map((o) => o.label)).toEqual(["Wifi", "Mascotas OK", "Lavadora"]);
    expect(chatAmenityRemoveMenuText(["wifi", "mascotas", "lavadora"])).toBe(
      "1. Wifi\n2. Mascotas OK\n3. Lavadora",
    );
    expect(parseChatAmenityRemoveReply("2", ["wifi", "mascotas", "lavadora"])).toEqual(["mascotas"]);
  });
});
