/** Applied before every Vitest file so crypto secrets stay stable across parallel suites. */
process.env.NODE_ENV = "test";
if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 16) {
  process.env.AUTH_JWT_SECRET = "test-auth-jwt-secret-32chars-min!!";
}
// Opt into demo seed so catalog/messenger tests have published Guadalajara listings.
if (process.env.SEED_DEMO_ON_EMPTY == null) {
  process.env.SEED_DEMO_ON_EMPTY = "1";
}
// Avoid cross-test exhaustion of the publish sliding window (default 30/hour).
if (process.env.RATE_LIMIT_POST_LISTINGS_MAX == null) {
  process.env.RATE_LIMIT_POST_LISTINGS_MAX = "10000";
}
