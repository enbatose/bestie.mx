import { describe, expect, it } from "vitest";
import { wizardContactDigits } from "./publishCore";

describe("wizardContactDigits", () => {
  it("keeps a real number even when the listing will not show it", () => {
    expect(wizardContactDigits("523329306218", false)).toBe("523329306218");
  });

  it("does not persist the draft placeholder as a real phone", () => {
    expect(wizardContactDigits("0000000000000", false)).toBe("0000000000000");
    expect(wizardContactDigits("", true)).toBe("0000000000000");
  });
});
