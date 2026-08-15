import { describe, expect, it } from "vitest";
import {
  applyWizardResumeSearchParams,
  hasWizardResumeQuery,
  publicarNavPath,
  readWizardPasoIndex,
} from "./wizardResumeUrl";

describe("wizardResumeUrl", () => {
  it("keeps Publicar nav on the in-progress wizard URL", () => {
    expect(publicarNavPath("/publicar", "?edit=P550E8400&paso=3")).toBe(
      "/publicar?edit=P550E8400&paso=3",
    );
    expect(publicarNavPath("/buscar", "?edit=P550E8400")).toBe("/publicar");
    expect(publicarNavPath("/publicar", "")).toBe("/publicar");
  });

  it("reads 1-based paso and 0-based publishStep", () => {
    expect(readWizardPasoIndex(new URLSearchParams("paso=3"))).toBe(2);
    expect(readWizardPasoIndex(new URLSearchParams("publishStep=2"))).toBe(2);
    expect(readWizardPasoIndex(new URLSearchParams("paso=1"))).toBe(0);
    expect(readWizardPasoIndex(new URLSearchParams())).toBeNull();
  });

  it("writes short property id and paso without a UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const next = applyWizardResumeSearchParams(new URLSearchParams(), {
      propertyId: uuid,
      stepIndex: 2,
    });
    expect(next.get("edit")).toBe("P550E8400");
    expect(next.get("paso")).toBe("3");
    expect(next.get("publishStep")).toBeNull();
    expect(hasWizardResumeQuery(next)).toBe(true);
  });

  it("keeps claim token instead of edit", () => {
    const next = applyWizardResumeSearchParams(new URLSearchParams("edit=P550E8400"), {
      assistedDraftToken: "claim-token",
      stepIndex: 4,
    });
    expect(next.get("borrador")).toBe("claim-token");
    expect(next.get("edit")).toBeNull();
    expect(next.get("paso")).toBe("5");
  });
});
