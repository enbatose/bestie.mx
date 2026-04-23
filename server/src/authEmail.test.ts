import { describe, expect, it } from "vitest";
import {
  authEmailForDb,
  canonicalLookupEmail,
  canonicalStorageEmail,
  displayStorageEmail,
  normalizeAuthEmailInput,
} from "./authEmail.js";

describe("email normalization", () => {
  it("normalizeAuthEmailInput lowercases and strips invisible chars", () => {
    expect(normalizeAuthEmailInput("  A@B.C \u200B")).toBe("a@b.c");
  });

  it("displayStorageEmail preserves dots and original local part characters", () => {
    expect(displayStorageEmail("Batani.Enrique@Gmail.COM")).toBe("batani.enrique@gmail.com");
    expect(displayStorageEmail("a.b.c@gmail.com")).toBe("a.b.c@gmail.com");
    expect(displayStorageEmail("user+tag@example.com")).toBe("user+tag@example.com");
  });

  it("canonicalLookupEmail strips dots only for gmail/googlemail", () => {
    expect(canonicalLookupEmail("Saava.Iren@gmail.com")).toBe("saavairen@gmail.com");
    expect(canonicalLookupEmail("a.b.c@googlemail.com")).toBe("abc@googlemail.com");
    expect(canonicalLookupEmail("User.Name@Example.COM")).toBe("user.name@example.com");
  });

  it("legacy aliases keep returning the canonical lookup form", () => {
    expect(authEmailForDb("Saava.Iren@gmail.com")).toBe("saavairen@gmail.com");
    expect(canonicalStorageEmail("a.b.c@gmail.com")).toBe("abc@gmail.com");
  });
});
