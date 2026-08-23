import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { PostHogProvider } from "@posthog/react";
import {
  identifyUser,
  resetAnalyticsUser,
  track,
  trackPageview,
} from "@/lib/analytics";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  hasAnalyticsConsent,
} from "@/lib/cookieConsent";
import { initPostHog, isPostHogConfigured, posthog } from "@/lib/posthog";
import { trackMetaPageview } from "@/lib/metaPixel";
import { consumeOAuthMethod } from "@/components/GoogleSignInButton";
import type { AuthMe } from "@/lib/authApi";

/** Wraps the tree with PostHog when configured + consented; otherwise a transparent passthrough. */
export function PostHogApp({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => Boolean(initPostHog()));

  useEffect(() => {
    const sync = () => setReady(Boolean(initPostHog()));
    sync();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!isPostHogConfigured() || !hasAnalyticsConsent() || !ready) return children;
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

/** Captures SPA pageviews (PostHog + Meta Pixel) on every react-router navigation. */
export function PostHogPageViews() {
  const location = useLocation();

  useEffect(() => {
    trackPageview(location.pathname, location.search);
    trackMetaPageview();
  }, [location.pathname, location.search]);

  return null;
}

/**
 * Binds the authenticated Bestie user to the PostHog person profile.
 * Call from the shell once `me` resolves (including after OAuth return).
 */
export function PostHogIdentify({ me }: { me: AuthMe | null | undefined }) {
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (me === undefined) return;

    if (me?.id) {
      if (lastId.current !== me.id) {
        identifyUser(me.id, {
          email: me.email,
          name: me.displayName,
          is_admin: me.isAdmin,
        });
        const oauth = consumeOAuthMethod();
        if (oauth) {
          track("user_logged_in", { method: oauth });
        }
        lastId.current = me.id;
      }
      return;
    }

    if (lastId.current) {
      resetAnalyticsUser();
      lastId.current = null;
    }
  }, [me]);

  return null;
}
