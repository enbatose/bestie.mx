import { describe, expect, it } from "vitest";
import { propertyRoomPencilTitle, propertyRoomSlotTitle } from "./roomDisplay";

describe("propertyRoomPencilTitle", () => {
  it("uses Recámara N for empty or generic numbered titles", () => {
    expect(propertyRoomSlotTitle(2)).toBe("Recámara 2");
    expect(propertyRoomPencilTitle({ title: "", customName: "" }, 2)).toBe("Recámara 2");
    expect(propertyRoomPencilTitle({ title: "Habitación 2", customName: "" }, 2)).toBe("Recámara 2");
    expect(propertyRoomPencilTitle({ title: "Recámara 2", customName: "" }, 2)).toBe("Recámara 2");
  });

  it("keeps a custom name", () => {
    expect(propertyRoomPencilTitle({ title: "Habitación 2", customName: "Cuarto con balcón" }, 2)).toBe(
      "Cuarto con balcón",
    );
  });
});
