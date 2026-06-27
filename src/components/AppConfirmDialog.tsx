type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
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
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-confirm-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id="app-confirm-title" className="text-lg font-bold text-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-body">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg hover:brightness-110 disabled:opacity-60"
          >
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
