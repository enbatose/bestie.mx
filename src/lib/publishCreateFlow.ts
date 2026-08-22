import type { PublishCreateFlow } from "@/lib/analytics";

/**
 * Maps wizard state → PostHog `create_flow` for publish funnels / replay playlists.
 *
 * - `ai` — self-serve paste / infográfico compose
 * - `manual` — "Sin IA" full wizard
 * - `assisted` — admin-assisted claim (`/borrador/:token`) when not on the AI compose path
 */
export function resolvePublishCreateFlow(
  roomCreateFlow: "ai" | "manual" | null | undefined,
  assistedToken: string | null | undefined,
): PublishCreateFlow {
  if (roomCreateFlow === "ai") return "ai";
  if (assistedToken) return "assisted";
  return "manual";
}

/** Assisted-claim source from the API → create_flow (self-serve stays `ai`). */
export function createFlowFromAssistedSource(
  source: "admin" | "self_serve" | string | null | undefined,
): PublishCreateFlow {
  return source === "self_serve" ? "ai" : "assisted";
}
