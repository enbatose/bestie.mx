import { describe, expect, it } from "vitest";
import { normalizeSourceFacebookUrl } from "./facebookPostUrl.js";

describe("normalizeSourceFacebookUrl", () => {
  it("matches group posts and permalink URLs with tracking params", () => {
    const a = normalizeSourceFacebookUrl(
      "https://www.facebook.com/groups/829477243867011/posts/1234567890123456/?rdid=abc&fbclid=IwAR",
    );
    const b = normalizeSourceFacebookUrl(
      "https://m.facebook.com/groups/829477243867011/permalink/1234567890123456/",
    );
    expect(a?.key).toBe("post:1234567890123456");
    expect(b?.key).toBe(a?.key);
    expect(a?.url).not.toContain("rdid");
    expect(a?.url).not.toContain("fbclid");
  });

  it("unwraps l.facebook.com redirects", () => {
    const inner = "https://www.facebook.com/groups/1/posts/99/";
    const wrapped = `https://l.facebook.com/l.php?u=${encodeURIComponent(inner)}`;
    expect(normalizeSourceFacebookUrl(wrapped)?.key).toBe("post:99");
  });

  it("keys share/p links and m-dot permalink query ids", () => {
    expect(normalizeSourceFacebookUrl("https://www.facebook.com/share/p/19AbCdef/")?.key).toBe(
      "share:19abcdef",
    );
    expect(
      normalizeSourceFacebookUrl("https://m.facebook.com/groups/829477243867011?view=permalink&id=555")?.key,
    ).toBe("post:555");
  });

  it("accepts URLs without a protocol", () => {
    expect(normalizeSourceFacebookUrl("facebook.com/groups/1/posts/22")?.key).toBe("post:22");
  });

  it("returns null for empty or huge input", () => {
    expect(normalizeSourceFacebookUrl("  ")).toBeNull();
    expect(normalizeSourceFacebookUrl(`https://facebook.com/${"x".repeat(3000)}`)).toBeNull();
  });
});
