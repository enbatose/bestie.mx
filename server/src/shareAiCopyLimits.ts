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
