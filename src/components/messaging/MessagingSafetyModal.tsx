import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { MessagingSafetyRole } from "@/lib/messagesApi";

type Props = {
  open: boolean;
  role: MessagingSafetyRole;
  busy?: boolean;
  error?: string | null;
  onAccept: () => void;
};

const SEEKER_TIPS = [
  "No pagues depósito ni renta antes de visitar el inmueble y firmar un contrato.",
  "Desconfía de urgencia, precios muy bajos y “dueños” que no pueden mostrarte la propiedad.",
  "Verifica identidad y que quien renta pueda demostrar relación con el inmueble.",
  "Si algo no cuadra, repórtalo en la conversación.",
] as const;

const PUBLISHER_TIPS = [
  "No compartas CLABE, claves ni documentos sensibles sin verificar a tu contraparte.",
  "Desconfía de comprobantes de pago falsos y de presión para “apartar” sin visita.",
  "Si algo no cuadra, repórtalo en la conversación.",
] as const;

/**
 * Blocking safety + liability acknowledgment before viewing peer listing messages.
 * Not dismissible via backdrop or Escape — user may leave /mensajes via browser back / nav.
 */
export function MessagingSafetyModal({ open, role, busy = false, error = null, onAccept }: Props) {
  const titleId = useId();
  const tipsId = useId();
  const legalId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState(false);
  const tips = role === "publisher" ? PUBLISHER_TIPS : SEEKER_TIPS;

  useEffect(() => {
    if (!open) {
      setChecked(false);
      return;
    }
    const t = window.setTimeout(() => checkboxRef.current?.focus(), 0);

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        return;
      }
      if (ev.key !== "Tab" || !panelRef.current) return;
      const focusables = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const canContinue = checked && !busy;

  return createPortal(
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={error ? `${tipsId} ${legalId} ${errorId}` : `${tipsId} ${legalId}`}
    >
      <div
        ref={panelRef}
        className="max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-warning-fg">Aviso de seguridad</p>
        <h2 id={titleId} className="mt-1 text-lg font-bold text-primary">
          Protégete al chatear
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
            Bestie solo facilita el contacto entre usuarios. No es parte del arrendamiento, no verifica
            cada anuncio ni identidad, y no garantiza acuerdos ni pagos entre ustedes.
          </p>
          <p className="mt-1.5">
            Al continuar, aceptas que eres responsable de verificar a tu contraparte y la propiedad, y
            que Bestie y su titular no responden por estafas, fraudes ni disputas derivadas de tus
            mensajes con otros usuarios. Esto complementa los{" "}
            <Link to="/legal/terminos" className="font-semibold underline">
              Términos
            </Link>
            .
          </p>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-body">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checked}
            disabled={busy}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
          />
          <span>He leído y acepto este aviso</span>
        </label>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canContinue}
          onClick={onAccept}
          className="mt-4 w-full min-h-11 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Entiendo y continuar"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
