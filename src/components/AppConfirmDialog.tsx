import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** `danger` styles the confirm action for destructive flows (archive, delete). */
  intent?: "default" | "danger";
  /** Inline error shown above the actions; keeps the dialog open on a failed confirm. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** In-app confirm dialog (replaces native window.confirm). */
export function AppConfirmDialog({
  open,
  title = "Confirmar",
  message,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  busy = false,
  intent = "default",
  error = null,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const t = window.setTimeout(() => cancelRef.current?.focus(), 0);

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !busy) {
        ev.preventDefault();
        onCancel();
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
      previousFocusRef.current?.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    intent === "danger"
      ? "flex-1 min-h-11 rounded-full border border-error/40 bg-error/10 py-2.5 text-sm font-semibold text-error transition hover:bg-error/15 disabled:opacity-60"
      : "flex-1 min-h-11 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={error ? `${descId} ${errorId}` : descId}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-primary">
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-body">
          {message}
        </p>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button type="button" disabled={busy} onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function replaceActiveSavedSearchNotifyMessage(
  otherLabel: string,
  targetLabel?: string,
): string {
  if (targetLabel) {
    return `Ya tienes alertas activas para «${otherLabel}». ¿Quieres recibir alertas de «${targetLabel}» en su lugar?`;
  }
  return `Ya tienes alertas activas para «${otherLabel}». ¿Quieres recibir alertas de esta búsqueda en su lugar?`;
}
