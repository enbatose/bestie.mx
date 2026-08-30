import { describe, expect, it } from "vitest";
import {
  listingClaimPreviewPath,
  publishWizardNavPatch,
  readClaimDraftReturnPath,
  sanitizeClaimDraftReturnPath,
} from "./publishWizardNavState";

describe("publishWizardNavState", () => {
  it("builds the outreach claim preview path", () => {
    expect(listingClaimPreviewPath("A4C68FDB6", "5842f63725004b899095cb0d0536e863386391c7")).toBe(
      "/anuncio/A4C68FDB6?claim=5842f63725004b899095cb0d0536e863386391c7",
    );
  });

  it("accepts only in-app claim and borrador paths", () => {
    expect(
      sanitizeClaimDraftReturnPath("/anuncio/A4C68FDB6?claim=5842f63725004b899095cb0d0536e863386391c7"),
    ).toBe("/anuncio/A4C68FDB6?claim=5842f63725004b899095cb0d0536e863386391c7");
    expect(sanitizeClaimDraftReturnPath("/borrador/abc_TOKEN-1")).toBe("/borrador/abc_TOKEN-1");
    expect(sanitizeClaimDraftReturnPath("https://evil.example/anuncio/A4C68FDB6?claim=x")).toBeNull();
    expect(sanitizeClaimDraftReturnPath("/anuncio/A4C68FDB6")).toBeNull();
    expect(sanitizeClaimDraftReturnPath("/admin/posts")).toBeNull();
  });

  it("reads claim return from wizard location state", () => {
    expect(readClaimDraftReturnPath({ fromAdminPosts: true })).toBeNull();
    expect(
      readClaimDraftReturnPath({
        fromAdminPosts: true,
        claimDraftReturnPath: "/anuncio/A4C68FDB6?claim=abc",
      }),
    ).toBe("/anuncio/A4C68FDB6?claim=abc");
    expect(publishWizardNavPatch({ fromAdminPosts: true, claimDraftReturnPath: "/admin" })).toEqual({
      fromAdminPosts: true,
    });
  });
});
