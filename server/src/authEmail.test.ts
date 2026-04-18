import { describe, expect, it } from "vitest";
import { authEmailForDb, canonicalStorageEmail, normalizeAuthEmailInput } from "./authEmail.js";

describe("authEmailForDb", () => {
  it("lowercases and strips invisible chars", () => {
    expect(normalizeAuthEmailInput("  A@B.C \u200B")).toBe("a@b.c");
  });

  it("canonicalizes gmail dots", () => {
    expect(authEmailForDb("Saava.Iren@gmail.com")).toBe("saavairen@gmail.com");
    expect(canonicalStorageEmail("a.b.c@gmail.com")).toBe("abc@gmail.com");
  });

  it("leaves non-gmail unchanged aside from case", () => {
    expect(authEmailForDb("User@Example.COM")).toBe("user@example.com");
  });
});
