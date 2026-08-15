import { describe, expect, it } from "vitest";
import { roomPreviewOptionLabel } from "./roomWizardValidation";

describe("roomPreviewOptionLabel", () => {
  it("uses Recámara N when the first property room has no title", () => {
    expect(roomPreviewOptionLabel({ title: "", customName: "" }, 0)).toBe("Recámara 1");
  });

  it("does not repeat numbered defaults like Recámara 2: Recámara 2", () => {
    expect(roomPreviewOptionLabel({ title: "Recámara 2", customName: "" }, 1)).toBe("Recámara 2");
    expect(roomPreviewOptionLabel({ title: "Habitación 3", customName: "" }, 2)).toBe("Recámara 3");
  });

  it("keeps a real custom name after the number", () => {
    expect(
      roomPreviewOptionLabel({ title: "Cuarto con balcón", customName: "" }, 0),
    ).toBe("Recámara 1: Cuarto con balcón");
  });
});
