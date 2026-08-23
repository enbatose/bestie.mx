import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  acceptAllCookies,
  readCookieConsent,
  rejectNonEssentialCookies,
  writeCookieConsent,
  type CookieConsentChoice,
} from "@/lib/cookieConsent";
import { initPostHog, optOutPostHogCapturing } from "@/lib/posthog";
import { initMetaPixel, trackMetaPageview } from "@/lib/metaPixel";

function applyConsent(choice: CookieConsentChoice): void {
  if (choice.analytics) {
    initPostHog();
  } else {
    optOutPostHogCapturing();
  }
  if (choice.marketing) {
    initMetaPixel();
    trackMetaPageview();
  }
}

const BANNER_OFFSET_VAR = "--bestie-cookie-banner-offset";

/**
 * Bottom banner for analytics (PostHog) + marketing (Meta Pixel) consent.
 * Essential cookies (session / auth) are always on and not listed as optional.
 * Mobile: safe-area insets, compact copy, side-by-side primary actions, scrollable customize.
 */
export function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  const refresh = useCallback(() => {
    const existing = readCookieConsent();
    if (existing) {
      setOpen(false);
      setCustomize(false);
      applyConsent(existing);
      return;
    }
    setOpen(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChanged);
  }, [refresh]);

  useEffect(() => {
    function onOpenPreferences() {
      const existing = readCookieConsent();
      if (existing) {
        setAnalytics(existing.analytics);
        setMarketing(existing.marketing);
      } else {
        setAnalytics(true);
        setMarketing(true);
      }
      setCustomize(true);
      setOpen(true);
    }
    window.addEventListener("bestie:open-cookie-preferences", onOpenPreferences);
    return () => window.removeEventListener("bestie:open-cookie-preferences", onOpenPreferences);
  }, []);

  /** Reserve space so fixed map/list CTAs aren’t fully hidden under the banner on phones. */
  useEffect(() => {
    const root = document.documentElement;
    if (!open) {
      root.style.removeProperty(BANNER_OFFSET_VAR);
      return;
    }
    // Approximate compact banner height; customize grows — still better than zero.
    root.style.setProperty(BANNER_OFFSET_VAR, customize ? "14rem" : "9.5rem");
    return () => root.style.removeProperty(BANNER_OFFSET_VAR);
  }, [open, customize]);

  if (!open) return null;

  const saveCustom = () => {
    const choice = writeCookieConsent({ analytics, marketing });
    applyConsent(choice);
    setOpen(false);
    setCustomize(false);
  };

  const reject = () => {
    const choice = rejectNonEssentialCookies();
    applyConsent(choice);
    setOpen(false);
    setCustomize(false);
  };

  const acceptAll = () => {
    const choice = acceptAllCookies();
    applyConsent(choice);
    setOpen(false);
    setCustomize(false);
  };

  const btnPrimary =
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-3 py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 active:scale-[0.99] sm:flex-none sm:px-5";
  const btnSecondary =
    "inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-body transition hover:bg-surface-elevated active:scale-[0.99] sm:flex-none sm:px-5";

  const panel = (
    <div
      className="fixed inset-x-0 bottom-0 z-[1900] rounded-t-2xl border-t border-border bg-surface/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/90 sm:rounded-none sm:bg-surface"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-3 pt-3 sm:gap-4 sm:px-5 sm:pt-5">
        <div className="min-w-0">
          <h2 id="cookie-consent-title" className="text-sm font-semibold text-primary">
            Cookies y medición
          </h2>
          {/* Short on mobile; fuller on sm+ */}
          <p className="mt-1 text-xs leading-snug text-muted sm:hidden">
            Necesarias para sesión. Con permiso: analítica y anuncios.{" "}
            <Link
              to="/legal/privacidad#cookies"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => setOpen(false)}
            >
              Privacidad
            </Link>
          </p>
          <p className="mt-1.5 hidden text-sm leading-relaxed text-muted sm:block">
            Usamos cookies necesarias para iniciar sesión. Con tu permiso también usamos analítica
            (PostHog) para mejorar Bestie y medición de anuncios (píxel de Meta). Puedes aceptar,
            rechazar lo no esencial o elegir. Detalles en el{" "}
            <Link
              to="/legal/privacidad#cookies"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Aviso de Privacidad
            </Link>
            .
          </p>
        </div>

        {customize ? (
          <div className="max-h-[min(40vh,16rem)] space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-bg-light p-2 text-sm text-body sm:max-h-none sm:space-y-2 sm:p-3">
            <label className="flex min-h-11 cursor-default items-center gap-3 rounded-lg px-2 py-1.5">
              <input type="checkbox" checked disabled className="size-4 shrink-0 accent-primary" />
              <span className="min-w-0 leading-snug">
                <span className="font-semibold">Necesarias</span>
                <span className="text-muted"> — sesión (siempre)</span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 active:bg-surface-elevated">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 leading-snug">
                <span className="font-semibold">Analítica</span>
                <span className="text-muted"> — uso del producto</span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 active:bg-surface-elevated">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 leading-snug">
                <span className="font-semibold">Marketing</span>
                <span className="text-muted"> — anuncios Meta</span>
              </span>
            </label>
          </div>
        ) : null}

        {/* Mobile: two equal primary actions side-by-side; “Elegir” as text to save height */}
        <div className="flex flex-col gap-2 pb-1">
          {customize ? (
            <div className="flex gap-2">
              <button type="button" onClick={reject} className={btnSecondary}>
                Solo necesarias
              </button>
              <button type="button" onClick={saveCustom} className={btnPrimary}>
                Guardar
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button type="button" onClick={reject} className={btnSecondary}>
                  Solo necesarias
                </button>
                <button type="button" onClick={acceptAll} className={btnPrimary}>
                  Aceptar todas
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCustomize(true)}
                className="min-h-10 w-full rounded-full text-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Elegir preferencias
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/** Footer / settings entry point to reopen the banner. */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("bestie:open-cookie-preferences"));
}
