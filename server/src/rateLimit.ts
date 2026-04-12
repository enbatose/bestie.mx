/** Sliding-window rate limiter (in-memory). */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export function createSlidingWindowLimiter(options: {
  windowMs: number;
  max: number;
}): (key: string) => RateLimitResult {
  const { windowMs, max } = options;
  const hits = new Map<string, number[]>();

  return (key: string): RateLimitResult => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const prev = hits.get(key) ?? [];
    const kept = prev.filter((t) => t > windowStart);
    if (kept.length >= max) {
      const oldest = kept[0]!;
      const retryAfterMs = Math.max(0, oldest + windowMs - now);
      hits.set(key, kept);
      return { ok: false, retryAfterMs };
    }
    kept.push(now);
    hits.set(key, kept);
    return { ok: true };
  };
}
