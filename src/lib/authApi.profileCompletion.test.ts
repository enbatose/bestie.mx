import { describe, expect, it } from "vitest";
import {
  isProviderManagedEmail,
  needsProfileCompletion,
  shouldAskProfilePhone,
  type AuthMe,
} from "./authApi";

function me(partial: Partial<AuthMe>): AuthMe {
  return {
    id: "u1",
    email: null,
    phoneE164: null,
    phoneVerified: false,
    phoneNotifyOptIn: false,
    phoneMarketingOptIn: false,
    phonePromptDismissedAt: null,
    displayName: "Test",
    createdAt: "2026-09-14T00:00:00.000Z",
    linkedPublisherIds: [],
    ...partial,
  };
}

describe("isProviderManagedEmail", () => {
  it("locks Google/Facebook email only when the provider already shared one", () => {
    expect(isProviderManagedEmail(me({ signInMethod: "facebook" }))).toBe(false);
    expect(isProviderManagedEmail(me({ signInMethod: "google" }))).toBe(false);
    expect(
      isProviderManagedEmail(me({ signInMethod: "facebook", email: "a@example.com" })),
    ).toBe(true);
    expect(isProviderManagedEmail(me({ signInMethod: "email", email: "a@example.com" }))).toBe(
      false,
    );
  });
});

describe("needsProfileCompletion", () => {
  it("asks Facebook/Google seekers with no email", () => {
    expect(needsProfileCompletion(me({ signInMethod: "facebook" }))).toBe(true);
    expect(needsProfileCompletion(me({ signInMethod: "google" }))).toBe(true);
  });

  it("asks WhatsApp placeholder names even with verified phone", () => {
    expect(
      needsProfileCompletion(
        me({
          displayName: "Usuario WhatsApp",
          phoneE164: "+523318632070",
          phoneVerified: true,
          signInMethod: "phone",
          email: "a@example.com",
          emailVerified: true,
        }),
      ),
    ).toBe(true);
    expect(
      needsProfileCompletion(
        me({
          displayName: "María",
          phoneE164: "+523318632070",
          phoneVerified: true,
          signInMethod: "phone",
          email: "a@example.com",
          emailVerified: true,
        }),
      ),
    ).toBe(false);
  });

  it("does not nag seekers who already have email and no phone", () => {
    expect(
      needsProfileCompletion(
        me({ email: "a@example.com", emailVerified: true, signInMethod: "google" }),
      ),
    ).toBe(false);
  });

  it("asks publishers missing phone even with email", () => {
    expect(
      needsProfileCompletion(
        me({
          email: "a@example.com",
          emailVerified: true,
          linkedPublisherIds: ["pub1"],
        }),
      ),
    ).toBe(true);
  });

  it("asks to finish an unverified phone", () => {
    expect(
      needsProfileCompletion(
        me({
          email: "a@example.com",
          emailVerified: true,
          phoneE164: "5215512345678",
          phoneVerified: false,
        }),
      ),
    ).toBe(true);
  });
});

describe("shouldAskProfilePhone", () => {
  it("follows email with phone when the session started without email", () => {
    expect(
      shouldAskProfilePhone(
        me({ email: "new@example.com", emailVerified: false, signInMethod: "facebook" }),
        { missingEmailAtOpen: true },
      ),
    ).toBe(true);
  });

  it("skips phone for seekers who already had email", () => {
    expect(
      shouldAskProfilePhone(
        me({ email: "a@example.com", emailVerified: true, signInMethod: "google" }),
        { missingEmailAtOpen: false },
      ),
    ).toBe(false);
  });

  it("skips phone when it is already verified", () => {
    expect(
      shouldAskProfilePhone(
        me({
          email: null,
          phoneE164: "5215512345678",
          phoneVerified: true,
          signInMethod: "phone",
        }),
        { missingEmailAtOpen: true },
      ),
    ).toBe(false);
  });
});
