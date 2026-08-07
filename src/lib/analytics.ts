import { isPostHogConfigured, posthog } from "@/lib/posthog";

/**
 * Bestie product analytics taxonomy (PostHog).
 *
 * UX principle: track decisions and outcomes that explain retention and conversion,
 * not every UI micro-interaction. Prefer properties that power funnels/cohorts.
 *
 * Funnel spine:
 *   home_search_submitted → search_results_loaded → search_listing_selected
 *   → listing_viewed → listing_message_sent
 *   OR home_cta_clicked(publish) → publish_mode_selected → publish_step_completed
 *   → publish_succeeded
 * Auth gates: *_auth_prompted / publish_auth_required / listing_auth_required
 */

export type AnalyticsAuthMethod = "email" | "google" | "facebook";

export type AnalyticsProps = {
  user_signed_up: { method: AnalyticsAuthMethod };
  user_logged_in: { method: AnalyticsAuthMethod };
  user_logged_out: Record<string, never>;

  home_search_submitted: { neighborhood_count: number };
  home_cta_clicked: {
    cta: "publish" | "faq" | "search_empty" | "city_guadalajara" | "map_gdl" | "seo_gdl_search";
  };

  search_results_loaded: {
    result_count: number;
    city_code: string;
    neighborhood_count: number;
    has_active_filters: boolean;
    error?: boolean;
  };
  search_filters_changed: { city_code: string; has_active_filters: boolean };
  search_filters_cleared: { city_code: string };
  search_city_selected: { city_code: string };
  search_neighborhood_selected: { city_code: string; neighborhood: string };
  search_listing_selected: {
    listing_id: string;
    source: "map" | "list" | "mobile";
    city_code: string;
  };
  search_save_clicked: { authenticated: boolean };
  search_follow_clicked: { authenticated: boolean };
  search_auth_prompted: { action: "save" | "follow" };
  search_saved: { city_code: string };
  search_follow_enabled: { city_code: string; had_email: boolean };

  listing_viewed: {
    listing_id: string;
    post_mode?: "room" | "property" | string | null;
    city?: string | null;
    from_search: boolean;
  };
  listing_share_copied: { listing_id: string };
  listing_share_ai_ready: {
    scope: "property" | "room";
    source: "stored" | "gemini" | "template";
    listing_id: string;
  };
  listing_share_ai_copied: { scope: "property" | "room"; listing_id: string };
  listing_share_ai_channel: {
    scope: "property" | "room";
    channel: "whatsapp" | "facebook" | "instagram" | "system";
    listing_id: string;
  };
  listing_contact_clicked: { listing_id: string };
  listing_message_sent: { listing_id: string; has_body: boolean };
  listing_auth_required: { listing_id: string; reason: "message" };

  publish_mode_selected: { mode: "room" | "property" };
  publish_step_completed: {
    step_index: number;
    step_title: string;
    mode: "room" | "property";
  };
  publish_step_back: {
    step_index: number;
    step_title: string;
    mode: "room" | "property";
  };
  publish_draft_saved: { mode: "room" | "property"; finish: boolean };
  publish_auth_required: { intent: "publish" | "draft"; mode: "room" | "property" };
  publish_succeeded: { mode: "room" | "property"; editing_live: boolean };
  publish_failed: { mode: "room" | "property"; reason: string };

  my_listing_status_changed: {
    listing_id: string;
    status: "paused" | "published" | "archived";
  };

  /** Room offered for rent vs marked as lived-in, from Mis Anuncios. */
  my_room_occupancy_changed: {
    listing_id: string;
    occupancy: "available" | "occupied";
  };

  group_created: Record<string, never>;
  group_joined: Record<string, never>;
};

export type AnalyticsEvent = keyof AnalyticsProps;

export function track<E extends AnalyticsEvent>(
  event: E,
  properties: AnalyticsProps[E],
): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.capture(event, properties as Record<string, unknown>);
  } catch {
    /* never break UX for analytics */
  }
}

export function identifyUser(
  userId: string,
  properties?: {
    email?: string | null;
    name?: string | null;
    is_admin?: boolean;
  },
): void {
  if (!isPostHogConfigured() || !userId) return;
  try {
    const props: Record<string, unknown> = {};
    if (properties?.email) props.email = properties.email;
    if (properties?.name) props.name = properties.name;
    if (properties?.is_admin != null) props.is_admin = properties.is_admin;
    posthog.identify(userId, Object.keys(props).length ? props : undefined);
  } catch {
    /* ignore */
  }
}

export function resetAnalyticsUser(): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.reset();
  } catch {
    /* ignore */
  }
}

/** SPA pageview — call on react-router location changes. */
export function trackPageview(pathname: string, search = ""): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.capture("$pageview", {
      $current_url: `${window.location.origin}${pathname}${search}`,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Client feature-flag helper. Safe when PostHog is unset (returns `defaultValue`).
 * Kill switches: `kill_switch_messaging`, `kill_switch_publish` (roll to 100% to enable).
 * Soft launch: `soft_launch_new_search_ui` (kept at 0% until ready).
 */
export function isFeatureEnabled(flag: string, defaultValue = false): boolean {
  if (!isPostHogConfigured()) return defaultValue;
  try {
    const value = posthog.isFeatureEnabled(flag);
    return value == null ? defaultValue : Boolean(value);
  } catch {
    return defaultValue;
  }
}
