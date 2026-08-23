import { useState } from "react";
import { Flag } from "lucide-react";

type Category = { id: string; label: string };

type Props = {
  open: boolean;
  title: string;
  categories: readonly Category[];
  disclaimer?: string;
  onClose: () => void;
  onSubmit: (input: { categories: string[]; detailText: string }) => Promise<void>;
};

export function ReportModal({ open, title, categories, disclaimer, onClose, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canSubmit = selected.length > 0 || detail.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ categories: selected, detailText: detail.trim() });
      setDone(true);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const friendly =
        raw === "not_found"
          ? "No encontramos ese anuncio. Recarga la página e inténtalo de nuevo."
          : raw === "rate_limited"
            ? "Demasiados reportes. Espera un momento e inténtalo de nuevo."
            : raw === "category_or_detail_required"
              ? "Elige al menos un motivo o escribe un detalle."
              : raw || "No se pudo enviar el reporte.";
      setErr(friendly);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setSelected([]);
    setDetail("");
    setErr(null);
    setDone(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-start gap-2">
          <Flag className="mt-0.5 size-5 shrink-0 text-error" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-body">{title}</h2>
            {disclaimer ? <p className="mt-1 text-xs leading-relaxed text-muted">{disclaimer}</p> : null}
          </div>
        </div>

        {done ? (
          <p className="text-sm text-body">Gracias. Revisaremos tu reporte.</p>
        ) : (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Motivo</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      on
                        ? "border-error/50 bg-error/10 text-error"
                        : "border-border bg-bg-light text-body hover:bg-surface-elevated"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="report-detail">
              Detalle (opcional)
            </label>
            <textarea
              id="report-detail"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
              placeholder="Cuéntanos qué ocurrió…"
            />
            {!canSubmit ? (
              <p className="mt-2 text-xs text-muted">Elige al menos un motivo o escribe un detalle.</p>
            ) : null}
            {err ? <p className="mt-2 text-xs text-error">{err}</p> : null}
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
          >
            {done ? "Cerrar" : "Cancelar"}
          </button>
          {!done ? (
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={() => void submit()}
              className="min-h-11 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-40"
            >
              {busy ? "Enviando…" : "Enviar reporte"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
