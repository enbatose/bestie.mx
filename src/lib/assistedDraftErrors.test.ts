import { describe, expect, it } from "vitest";
import { assistedDraftUserMessage, isAlreadyClaimedByOtherError } from "@/lib/assistedDraftErrors";

describe("assistedDraftUserMessage", () => {
  it("prefers a Spanish server message over the error code", () => {
    expect(assistedDraftUserMessage("already_claimed", "Este borrador ya está ligado a una cuenta.")).toBe(
      "Este borrador ya está ligado a una cuenta.",
    );
  });

  it("maps already_claimed instead of showing the raw code", () => {
    expect(assistedDraftUserMessage("already_claimed")).toMatch(/ligado a una cuenta/i);
    expect(assistedDraftUserMessage("already_claimed")).not.toBe("already_claimed");
  });

  it("maps evidence_required for admin outreach publish", () => {
    expect(assistedDraftUserMessage("evidence_required")).toMatch(/captura de consentimiento/i);
  });

  it("maps a snake_case message the same as an error code", () => {
    expect(assistedDraftUserMessage(undefined, "already_claimed_by_other")).toMatch(/otra cuenta/i);
  });

  it("detects claimed-by-other from code or Spanish copy", () => {
    expect(isAlreadyClaimedByOtherError("already_claimed_by_other")).toBe(true);
    expect(isAlreadyClaimedByOtherError("Este anuncio ya fue reclamado por otra cuenta.")).toBe(true);
    expect(isAlreadyClaimedByOtherError("Este número ya está verificado en otra cuenta.")).toBe(false);
    expect(isAlreadyClaimedByOtherError("Falta el precio de renta.")).toBe(false);
  });
});
