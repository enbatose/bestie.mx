import { useState } from "react";
import { ChevronDown, ShieldAlert } from "lucide-react";

/**
 * Operator playbook for fraud / misconduct reports (posts + chats).
 * Internal guidance only — not a public SLA and not a promise to recover money.
 */
export function AdminFraudReportChecklist() {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-warning/40 bg-warning/10 text-sm text-body">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <ShieldAlert className="size-4 shrink-0 text-warning-fg" aria-hidden />
        <span className="min-w-0 flex-1 font-semibold text-warning-fg">
          Checklist · reportes de estafa / abuso
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-warning-fg transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-warning/30 px-4 py-3 text-xs leading-relaxed sm:text-sm">
          <p className="text-muted">
            Meta interna (no es garantía pública). Objetivo: limpiar la plataforma, no recuperar
            dinero ni mediar el arrendamiento. Prioriza reportes con motivo <strong>estafa</strong>.
          </p>

          <ol className="list-decimal space-y-2 pl-4 marker:font-semibold">
            <li>
              <strong>Abrir el hilo de reporte</strong> — lee categorías, detalle, anuncio o chat
              enlazado y quién reportó.
            </li>
            <li>
              <strong>Clasificar en ~2 minutos</strong>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">
                <li>
                  Señales de estafa (depósito antes de visita, urgencia, precios irreales, fotos
                  dudosas, “dueño” que no puede mostrar) → pausar / ocultar el anuncio; restringir
                  cuenta si es reincidente.
                </li>
                <li>Acoso / ofensas en chat → advertir o restringir; el anuncio puede quedar.</li>
                <li>Reporte vengativo o sin evidencia → marcar revisado; dejar el anuncio.</li>
                <li>Duda → una pregunta corta al reportador en el hilo; no dejarlo semanas.</li>
              </ul>
            </li>
            <li>
              <strong>Actuar en el inventario</strong> — usa las acciones del panel (pausar post,
              contactar reportador, marcar revisado). No prometas recuperar pagos ni ser parte del
              contrato.
            </li>
            <li>
              <strong>Responder breve</strong> — p. ej. “Revisamos y pausamos el anuncio” o “No vimos
              evidencia suficiente; si tienes más datos, responde aquí.” Recuerda: no pagar antes de
              visitar y firmar.
            </li>
            <li>
              <strong>Cerrar</strong> — marca el reporte como revisado. Guarda el hilo como evidencia
              de que Bestie actuó.
            </li>
          </ol>

          <p className="rounded-xl border border-border bg-surface/80 px-3 py-2 text-muted">
            <strong className="text-body">SLA personal sugerido:</strong> mismo día o al día
            siguiente si el motivo es estafa. No publiques un “24 h garantizadas” en Términos.
          </p>
        </div>
      ) : null}
    </div>
  );
}
