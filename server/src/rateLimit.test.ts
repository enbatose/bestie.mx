import { describe, expect, it } from "vitest";
import { createSlidingWindowLimiter } from "./rateLimit.js";

describe("createSlidingWindowLimiter", () => {
  it("allows up to max hits inside the window", () => {
    const limiter = createSlidingWindowLimiter({ windowMs: 10_000, max: 3 });
    expect(limiter("a")).toEqual({ ok: true });
    expect(limiter("a")).toEqual({ ok: true });
    expect(limiter("a")).toEqual({ ok: true });
    const fourth = limiter("a");
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("tracks keys independently", () => {
    const limiter = createSlidingWindowLimiter({ windowMs: 10_000, max: 1 });
    expect(limiter("x")).toEqual({ ok: true });
    expect(limiter("y")).toEqual({ ok: true });
  });
});
