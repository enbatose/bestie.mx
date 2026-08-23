import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  acceptAllCookies,
  hasCookieConsentDecision,
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

/**
 * Bottom banner for analytics (PostHog) + marketing (Meta Pixel) consent.
 * Essential cookies (session / auth) are always on and not listed as optional.
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

  if (!open) return null;

  const saveCustom = () => {
    const choice = writeCookieConsent({ analytics, marketing });
    applyConsent(choice);
    setOpen(false);
    setCustomize(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1900] border-t border-border bg-surface p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:p-5"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h2 id="cookie-consent-title" className="text-sm font-semibold text-primary">
            Cookies y medición
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">
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
          <div className="space-y-2 rounded-xl border border-border bg-bg-light p-3 text-sm text-body">
            <label className="flex items-start gap-2">
              <input type="checkbox" checked disabled className="mt-0.5 accent-primary" />
              <span>
                <span className="font-semibold">Necesarias</span> — sesión e inicio de sesión (siempre
                activas).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-semibold">Analítica</span> — PostHog (uso del producto, errores,
                grabaciones de sesión enmascaradas).
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-semibold">Marketing</span> — píxel de Meta (Facebook / Instagram
                Ads).
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {!customize ? (
            <button
              type="button"
              onClick={() => setCustomize(true)}
              className="min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
            >
              Elegir
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const choice = rejectNonEssentialCookies();
              applyConsent(choice);
              setOpen(false);
              setCustomize(false);
            }}
            className="min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
          >
            Solo necesarias
          </button>
          {customize ? (
            <button
              type="button"
              onClick={saveCustom}
              className="min-h-11 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:brightness-110"
            >
              Guardar preferencias
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const choice = acceptAllCookies();
                applyConsent(choice);
                setOpen(false);
              }}
              className="min-h-11 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:brightness-110"
            >
              Aceptar todas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Footer / settings entry point to reopen the banner. */
export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  if (!hasCookieConsentDecision()) {
    window.dispatchEvent(new Event("bestie:open-cookie-preferences"));
    return;
  }
  window.dispatchEvent(new Event("bestie:open-cookie-preferences"));
}
