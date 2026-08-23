import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminFetchReportContext,
  adminMarkReportReviewed,
  adminReportAction,
  type AdminReportContext,
} from "@/lib/authApi";
import { adminSectionPath } from "@/lib/adminSections";

type Props = {
  conversationId: string;
  onRefreshThread: () => void;
};

export function AdminReportActions({ conversationId, onRefreshThread }: Props) {
  const [ctx, setCtx] = useState<AdminReportContext | null>(null);
  const [historyDays, setHistoryDays] = useState<number | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCtx(
        await adminFetchReportContext(conversationId, {
          historyDays: historyDays === "all" ? undefined : historyDays,
        }),
      );
    } catch {
      setCtx(null);
    }
  }, [conversationId, historyDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: string, body?: Record<string, unknown>) => {
    setBusy(action);
    setErr(null);
    try {
      await adminReportAction(conversationId, action, body);
      await load();
      onRefreshThread();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  if (!ctx) return null;

  return (
    <div className="border-b border-border bg-bg-light p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error">
          Reporte · {ctx.report.reportCount}
        </span>
        {!ctx.report.reviewedAt ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void act("mark-reviewed")}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-elevated disabled:opacity-50"
          >
            Marcar como revisado
          </button>
        ) : (
          <span className="text-xs text-muted">Revisado</span>
        )}
        {ctx.postUrl ? (
          <a
            href={ctx.postUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-elevated"
          >
            Abrir anuncio
          </a>
        ) : null}
        {ctx.report.targetPropertyId ? (
          <>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void act("pause-post")}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-elevated disabled:opacity-50"
            >
              Pausar
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void act("resume-post")}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-elevated disabled:opacity-50"
            >
              Reanudar
            </button>
            {ctx.propertyStatus === "pending_review" ? (
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void act("approve-changes")}
                className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg disabled:opacity-50"
              >
                Aprobar cambios
              </button>
            ) : null}
          </>
        ) : null}
        {ctx.report.publisherUserId ? (
          <>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void act("block-publisher")}
              className="rounded-full border border-error/40 px-3 py-1 text-xs font-semibold text-error hover:bg-error/5 disabled:opacity-50"
            >
              Bloquear anunciante
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void act("contact-publisher")}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-elevated disabled:opacity-50"
            >
              Contactar anunciante
            </button>
          </>
        ) : null}
        {ctx.latestReporterId ? (
          <Link
            to={`${adminSectionPath("users")}?u=${encodeURIComponent(ctx.latestReporterId)}`}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-elevated"
          >
            Ver reportador
          </Link>
        ) : (
          <span className="text-xs text-muted">Reportador desconocido</span>
        )}
        {ctx.latestReporterId ? (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void act("contact-reporter")}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold hover:bg-surface-elevated disabled:opacity-50"
          >
            Contactar reportador
          </button>
        ) : null}
      </div>

      <dl className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
        <div>
          Reportes en este anuncio: <strong className="text-body">{ctx.stats.reportsAgainstPost}</strong>
        </div>
        <div>
          Reportes contra anunciante:{" "}
          <strong className="text-body">{ctx.stats.reportsAgainstPublisherPosts}</strong> en{" "}
          {ctx.stats.postsReportedForPublisher} anuncios
        </div>
        {ctx.latestReporterId ? (
          <>
            <div>
              Reportes enviados por usuario:{" "}
              <strong className="text-body">{ctx.stats.reportsFiledByUser}</strong>
            </div>
            <div>
              Marcas de abuso: <strong className="text-body">{ctx.stats.abuseFlagsForReporter}</strong>
            </div>
          </>
        ) : null}
      </dl>

      {ctx.report.targetType === "chat" ? (
        <div className="mt-2">
          <label className="mr-2 text-xs font-semibold text-muted">Historial chat</label>
          <select
            value={historyDays === "all" ? "all" : String(historyDays)}
            onChange={(e) =>
              setHistoryDays(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
          >
            <option value="all">Todo</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
          </select>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface p-2 text-xs">
            {ctx.chatHistory.map((m) => (
              <li key={m.id}>
                <span className="font-semibold text-body">{m.senderUserId.slice(0, 8)}…</span>: {m.body}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ctx.reporters.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs">
          {ctx.reporters.map((r) => (
            <li key={r.eventId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1">
              <span>{r.categories.join(", ")}</span>
              {r.reporterUserId ? (
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={() => void act("flag-abuse", { reportEventId: r.eventId })}
                  className="text-error underline disabled:opacity-50"
                >
                  Marcar abuso
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {err ? <p className="mt-2 text-xs text-error">{err}</p> : null}
    </div>
  );
}
