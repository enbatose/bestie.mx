/** Default privacy disk when hiding the exact address (wizard + public jitter). */
export const APPROXIMATE_LOCATION_RADIUS_DEFAULT_M = 200;

/** Smallest privacy perimeter the publisher can choose. */
export const APPROXIMATE_LOCATION_RADIUS_MIN_M = 100;

/** Largest privacy perimeter the publisher can choose. */
export const APPROXIMATE_LOCATION_RADIUS_MAX_M = 1000;

export function clampApproximateRadiusMeters(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return APPROXIMATE_LOCATION_RADIUS_DEFAULT_M;
  return Math.round(
    Math.min(
      APPROXIMATE_LOCATION_RADIUS_MAX_M,
      Math.max(APPROXIMATE_LOCATION_RADIUS_MIN_M, n),
    ),
  );
}

/** Public maps / jitter: use stored radius, else the product default. */
export function resolveApproximateRadiusMeters(
  stored: number | null | undefined,
): number {
  if (stored == null || !Number.isFinite(stored)) {
    return APPROXIMATE_LOCATION_RADIUS_DEFAULT_M;
  }
  return clampApproximateRadiusMeters(stored);
}
