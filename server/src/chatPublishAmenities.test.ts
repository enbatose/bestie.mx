import { describe, expect, it } from "vitest";
import {
  CHAT_AMENITY_OPTIONS,
  chatAmenityMenuText,
  chatAmenitySelected,
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

  it("shows the full 1–6 menu with checkmarks for known tags", () => {
    const text = chatAmenityMenuText(["wifi", "baño-privado"]);
    expect(text).toContain("1. Wifi ✅");
    expect(text).toContain("2. Amueblado");
    expect(text).toContain("3. Baño privado ✅");
    expect(text).toContain("4. Estacionamiento");
    expect(text).toContain("5. Mascotas OK");
    expect(text).toContain("6. Lavadora");
  });

  it("parses numbered amenity replies", () => {
    expect(parseChatAmenityReply("1, 4 y 5")).toEqual(["wifi", "estacionamiento", "mascotas"]);
    expect(chatAmenitySelected(["wifi", "mascotas", "lavadora"]).map((o) => o.label)).toEqual([
      "Wifi",
      "Mascotas OK",
      "Lavadora",
    ]);
  });
});
