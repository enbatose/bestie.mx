/** Full clipboard payload (AI body + blank line + Bestie permalink) hard cap. */
export const SHARE_AI_TEXT_MAX = 700;

/**
 * Soft target for the generator body (before `\n\n` + permalink).
 * Leave ~80–120 chars for the link + CTA so Gemini does not fill the hard cap
 * and get mid-sentence truncated by {@link finalizeShareCopy}.
 */
export const SHARE_AI_BODY_TARGET = 520;

/** Soft cap on amenity / preference bullet lines in the share message. */
export const SHARE_AI_MAX_BULLETS = 5;

/** Generate endpoint: max requests per IP per minute (includes cache hits). */
export const SHARE_AI_GENERATE_IP_MAX_PER_MIN = 20;

/** Generate endpoint: max requests per publisher per minute (includes cache hits). */
export const SHARE_AI_GENERATE_PUB_MAX_PER_MIN = 30;

/** Explicit `force: true` regenerations per publisher per hour (Gemini cost guard). */
export const SHARE_AI_FORCE_MAX_PER_HOUR = 5;

/** PATCH save endpoint: max writes per publisher per minute. */
export const SHARE_AI_PATCH_MAX_PER_MIN = 60;
