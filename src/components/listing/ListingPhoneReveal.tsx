import { Eye, EyeOff, Phone } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuthModal } from "@/contexts/AuthModalContext";
import type { AuthMe } from "@/lib/authApi";
import {
  fetchListingContactPhone,
  fetchPhoneRevealSafetyStatus,
  postPhoneRevealSafetyAcknowledgment,
  type PhoneRevealSafetyRole,
} from "@/lib/listingPhoneApi";
import { formatListingPhoneDisplay, maskedMxPhoneHint } from "@/lib/mxPhone";

type Props = {
  listingId: string;
  propertyId?: string;
  /** When false / missing, render nothing. */
  hasContactPhone?: boolean;
  viewer: AuthMe | null | undefined;
  /** Claim-link preview: fetch digits via the token (drafts are not on the published contact-phone path). */
  claimToken?: string | null;
  /** Prefer seeker tips unless the viewer owns the listing. */
  role?: PhoneRevealSafetyRole;
  className?: string;
  /** Mobile vs desktop copy density. */
  compact?: boolean;
  /** Hero: hug the number + Mostrar on desktop instead of stretching across the header. */
  fit?: boolean;
};

const SEEKER_TIPS = [
  "No envíes depósitos ni rentas por transferencia/WhatsApp antes de visitar y firmar.",
  "Desconfía de urgencia, precios irreales o quien solo atiende por llamada/SMS y evita verse.",
  "Prefiere coordinar primero en el chat de Bestie; el teléfono es un canal extra, no una garantía.",
  "Si te piden códigos de WhatsApp, CLABE o “seguro” por anticipado, repórtalo.",
] as const;

const PUBLISHER_TIPS = [
  "No compartas CLABE, códigos OTP ni documentos sensibles por SMS/WhatsApp sin verificar a la persona.",
  "Desconfía de comprobantes falsos y de presión para “apartar” el cuarto solo por mensaje.",
  "Si alguien pide que reveles datos bancarios o ignores el chat de Bestie, repórtalo.",
] as const;

function WhatsAppMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.82c2.17 0 4.21.85 5.75 2.38a8.08 8.08 0 0 1 2.37 5.75c0 4.48-3.65 8.12-8.12 8.12-1.42 0-2.8-.36-4.02-1.05l-.29-.17-3.12.82.83-3.04-.19-.31a8.1 8.1 0 0 1-1.24-4.37c0-4.48 3.65-8.13 8.13-8.13zm4.52 10.52c-.2-.1-1.18-.58-1.36-.65-.18-.07-.31-.1-.44.1-.13.2-.5.65-.62.78-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.53-.99-1.18-1.1-1.38-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.33h-.38c-.13 0-.34.05-.52.25-.18.2-.68.67-.68 1.63s.7 1.89.8 2.02c.1.13 1.37 2.1 3.32 2.94.46.2.83.32 1.11.41.47.15.89.13 1.23.08.37-.06 1.18-.48 1.35-.95.17-.47.17-.87.12-.95-.05-.08-.18-.13-.38-.23z"
      />
    </svg>
  );
}

function PhoneRevealSafetyModal({
  open,
  role,
  busy,
  error,
  onAccept,
}: {
  open: boolean;
  role: PhoneRevealSafetyRole;
  busy?: boolean;
  error?: string | null;
  onAccept: () => void;
}) {
  const titleId = useId();
  const tipsId = useId();
  const legalId = useId();
  const [checked, setChecked] = useState(false);
  const tips = role === "publisher" ? PUBLISHER_TIPS : SEEKER_TIPS;

  useEffect(() => {
    if (!open) setChecked(false);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={`${tipsId} ${legalId}`}
    >
      <div className="max-h-[min(92dvh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-warning-fg">Aviso de seguridad</p>
        <h2 id={titleId} className="mt-1 text-lg font-bold text-primary">
          Protégete al usar el teléfono
        </h2>
        <ul id={tipsId} className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-body">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <div
          id={legalId}
          className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-3 py-3 text-xs leading-relaxed text-warning-fg"
        >
          <p className="font-semibold">Aviso legal</p>
          <p className="mt-1.5">
            Bestie solo facilita el contacto. No verifica cada anuncio ni identidad, y no es parte del
            arrendamiento ni de llamadas, SMS o WhatsApp fuera de la plataforma.
          </p>
          <p className="mt-1.5">
            Al continuar, aceptas que eres responsable de verificar a tu contraparte y que Bestie y su
            titular no responden por estafas o disputas derivadas del uso del teléfono. Esto complementa
            los{" "}
            <Link to="/legal/terminos" className="font-semibold underline">
              Términos
            </Link>
            .
          </p>
        </div>
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-body">
          <input
            type="checkbox"
            checked={checked}
            disabled={busy}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
          />
          <span>He leído y acepto este aviso</span>
        </label>
        {error ? (
          <p role="alert" className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!checked || busy}
          onClick={onAccept}
          className="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Ver teléfono"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Login-gated phone reveal. Digits are fetched from the server only after auth + safety ack —
 * they are never present in the public listing JSON (so DevTools / crawlers cannot scrape them).
 */
export function ListingPhoneReveal({
  listingId,
  propertyId,
  hasContactPhone,
  viewer,
  role = "seeker",
  className = "",
  compact = false,
  fit = false,
  claimToken = null,
}: Props) {
  const { openLogin } = useAuthModal();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const returnPath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash || ""}`.replace(
          /([?&])revealPhone=1(&|$)/,
          "$1",
        )
      : "/";

  const ensureRevealQuery = useCallback(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("revealPhone", "1");
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return returnPath.includes("revealPhone=1") ? returnPath : `${returnPath}${returnPath.includes("?") ? "&" : "?"}revealPhone=1`;
    }
  }, [returnPath]);

  useEffect(() => {
    if (!viewer) {
      setSafetyAccepted(null);
      setRevealed(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const st = await fetchPhoneRevealSafetyStatus();
        if (!cancelled) setSafetyAccepted(st.accepted);
      } catch {
        if (!cancelled) setSafetyAccepted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer?.id]);

  const loadPhone = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetchListingContactPhone(listingId, { claimToken });
      setRevealed(res.phoneDigits);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo mostrar el teléfono.";
      if (msg === "safety_required") {
        setSafetyAccepted(false);
        setSafetyOpen(true);
      } else if (msg === "unauthorized") {
        openLogin(ensureRevealQuery());
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  }, [ensureRevealQuery, listingId, openLogin, claimToken]);

  useEffect(() => {
    if (!hasContactPhone || !viewer || revealed) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("revealPhone") === "1") {
        if (safetyAccepted === false) setSafetyOpen(true);
        else if (safetyAccepted === true) void loadPhone();
      }
    } catch {
      /* ignore */
    }
  }, [hasContactPhone, viewer, safetyAccepted, revealed, loadPhone]);

  if (!hasContactPhone) return null;

  const onEyeClick = () => {
    setErr(null);
    if (!viewer) {
      openLogin(ensureRevealQuery());
      return;
    }
    if (safetyAccepted === false) {
      setSafetyOpen(true);
      return;
    }
    void loadPhone();
  };

  const onAcceptSafety = async () => {
    setBusy(true);
    setErr(null);
    try {
      await postPhoneRevealSafetyAcknowledgment({
        role,
        propertyId: propertyId ?? null,
      });
      setSafetyAccepted(true);
      setSafetyOpen(false);
      await loadPhone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar el aviso.");
    } finally {
      setBusy(false);
    }
  };

  const display = revealed ? formatListingPhoneDisplay(revealed) : maskedMxPhoneHint();
  const telHref = revealed
    ? `tel:+${revealed.replace(/\D/g, "")}`
    : undefined;
  const waHref = revealed
    ? `https://wa.me/${revealed.replace(/\D/g, "")}`
    : undefined;

  return (
    <div
      className={`max-w-full rounded-xl border border-border bg-surface p-3 sm:p-4 ${
        fit ? "w-full sm:w-max sm:self-start" : "w-full"
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Phone className="size-4" aria-hidden />
        </div>
        <div className={fit ? "min-w-0" : "min-w-0 flex-1"}>
          <p className="text-sm font-semibold text-body">Teléfono / móvil</p>
          {compact || fit ? (
            <p className="mt-0.5 text-xs leading-snug text-muted">
              {fit ? (
                "Inicia sesión para verlo."
              ) : (
                <>
                  <span className="sm:hidden">Inicia sesión para verlo.</span>
                  <span className="hidden sm:inline">
                    Idealmente el número de WhatsApp. Inicia sesión para verlo y aceptar los términos.
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-snug text-muted">
              Idealmente el número que usas en WhatsApp. Inicia sesión para verlo y aceptar los términos.
            </p>
          )}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="break-all font-mono text-base tabular-nums text-body sm:text-sm">{display}</span>
            <button
              type="button"
              onClick={revealed ? () => setRevealed(null) : onEyeClick}
              disabled={busy || viewer === undefined}
              className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-bg-light px-3 py-1.5 text-xs font-semibold text-body transition hover:bg-surface-elevated disabled:opacity-50 sm:w-auto"
              aria-label={revealed ? "Ocultar teléfono" : "Mostrar teléfono"}
            >
              {revealed ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              <span className="sm:hidden">
                {busy ? "…" : revealed ? "Ocultar" : viewer ? "Mostrar" : "Inicia sesión"}
              </span>
              <span className="hidden sm:inline">
                {busy ? "…" : revealed ? "Ocultar" : viewer ? "Mostrar" : "Inicia sesión para ver"}
              </span>
            </button>
          </div>
          {revealed && (telHref || waHref) ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {telHref ? (
                <a
                  href={telHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-body hover:bg-surface-elevated"
                >
                  Llamar
                </a>
              ) : null}
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-body hover:bg-[#25D366]/15"
                >
                  <WhatsAppMark className="size-3.5 text-[#25D366]" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}
          {err ? <p className="mt-2 text-xs text-error">{err}</p> : null}
        </div>
      </div>
      <PhoneRevealSafetyModal
        open={safetyOpen}
        role={role}
        busy={busy}
        error={err}
        onAccept={() => void onAcceptSafety()}
      />
    </div>
  );
}
