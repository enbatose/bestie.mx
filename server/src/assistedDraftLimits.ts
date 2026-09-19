/** Public self-serve compose: Gemini cost guard (in-memory per process). */

import { LISTING_IMAGE_COUNT_MAX } from "./validation.js";

export const SELF_SERVE_COMPOSE_IP_MAX_PER_HOUR = 8;
export const SELF_SERVE_COMPOSE_WINDOW_MS = 60 * 60 * 1000;

export const SELF_SERVE_MAX_INFOGRAPHICS = 2;
/** Matches {@link LISTING_IMAGE_COUNT_MAX} — never accept more photos than we publish. */
export const SELF_SERVE_MAX_PHOTOS = LISTING_IMAGE_COUNT_MAX;
export const SELF_SERVE_MAX_TEXT_CHARS = 12_000;

/**
 * Chat gallery is space photos + infographics, capped at the listing max.
 * Infographics are collected first on WhatsApp, so the photo step shrinks.
 */
export function listingPhotoSlotsRemaining(infographicCount: number): number {
  const infos = Math.min(
    SELF_SERVE_MAX_INFOGRAPHICS,
    Math.max(0, Math.floor(infographicCount) || 0),
  );
  return Math.max(0, LISTING_IMAGE_COUNT_MAX - infos);
}
