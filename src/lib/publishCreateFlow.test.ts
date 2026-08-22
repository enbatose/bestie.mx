import { describe, expect, it } from "vitest";
import {
  createFlowFromAssistedSource,
  resolvePublishCreateFlow,
} from "./publishCreateFlow";

describe("resolvePublishCreateFlow", () => {
  it("maps AI compose, Sin IA (manual), and assisted claim paths", () => {
    expect(resolvePublishCreateFlow("ai", null)).toBe("ai");
    expect(resolvePublishCreateFlow("ai", "tok")).toBe("ai");
    expect(resolvePublishCreateFlow("manual", null)).toBe("manual");
    expect(resolvePublishCreateFlow("manual", "")).toBe("manual");
    expect(resolvePublishCreateFlow("manual", "claim-token")).toBe("assisted");
    expect(resolvePublishCreateFlow(undefined, "claim-token")).toBe("assisted");
    expect(resolvePublishCreateFlow(null, null)).toBe("manual");
  });
});

describe("createFlowFromAssistedSource", () => {
  it("keeps self-serve as ai and admin claims as assisted", () => {
    expect(createFlowFromAssistedSource("self_serve")).toBe("ai");
    expect(createFlowFromAssistedSource("admin")).toBe("assisted");
    expect(createFlowFromAssistedSource(undefined)).toBe("assisted");
    expect(createFlowFromAssistedSource("other")).toBe("assisted");
  });
});
