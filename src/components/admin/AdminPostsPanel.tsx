import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ADMIN_POSTS_PAGE_SIZES,
  adminListPosts,
  adminPatchPropertyStatus,
  type AdminPostRow,
  type AdminPostStatus,
} from "@/lib/authApi";

const STATUS_OPTIONS: { value: AdminPostStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "published", label: "Publicado" },
  { value: "paused", label: "Pausado" },
  { value: "archived", label: "Archivado" },
];

function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusLabel(status: AdminPostStatus): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "published":
      return "Publicado";
    case "paused":
      return "Pausado";
    case "archived":
      return "Archivado";
  }
}

function statusBadgeClass(status: AdminPostStatus): string {
  switch (status) {
    case "published":
      return "bg-primary/10 text-primary";
    case "paused":
      return "bg-warning/15 text-body";
    case "draft":
      return "bg-bg-light text-body ring-1 ring-border";
    case "archived":
      return "bg-bg-light text-muted ring-1 ring-border";
  }
}

function AiOriginBadge() {
  return (
    <span
      className="inline-flex rounded-full bg-secondary/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
      title="Generado con IA"
    >
      IA
    </span>
  );
}

type Props = {
  onError: (message: string | null) => void;
};

export function AdminPostsPanel({ onError }: Props) {
  const [rows, setRows] = useState<AdminPostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminPostStatus | "all">("published");
  const [pageSize, setPageSize] = useState<(typeof ADMIN_POSTS_PAGE_SIZES)[number]>(25);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ, statusFilter, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const r = await adminListPosts({
        q: debouncedQ || undefined,
        status: statusFilter,
        limit: pageSize,
        offset: page * pageSize,
      });
      setRows(r.posts);
      setTotal(r.total);
    } catch (x) {
      onError(x instanceof Error ? x.message : "No se pudo cargar el reporte de posts.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, statusFilter, pageSize, page, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const setStatus = async (row: AdminPostRow, status: AdminPostStatus) => {
    setBusyId(row.propertyId);
    setActionNote(null);
    onError(null);
    try {
      await adminPatchPropertyStatus(row.propertyId, status);
      setActionNote(`${row.shortId} → ${statusLabel(status)}`);
      await load();
    } catch (x) {
      onError(x instanceof Error ? x.message : "No se pudo actualizar el estado.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="block min-w-0 flex-1 text-sm font-medium text-body">
          Buscar
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ID, título, correo, IA, estado, paso, feedback…"
            className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="block text-sm font-medium text-body lg:w-44">
          Estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AdminPostStatus | "all")}
            className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-body lg:w-36">
          Por página
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as (typeof ADMIN_POSTS_PAGE_SIZES)[number])}
            className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
          >
            {ADMIN_POSTS_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Actualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <p>
          {loading ? "Cargando…" : `${total} post${total === 1 ? "" : "s"}`}
          {actionNote ? <span className="ml-2 text-primary">· {actionNote}</span> : null}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface lg:block">
        <table className="min-w-[1100px] w-full text-left text-xs">
          <thead className="border-b border-border bg-bg-light/80 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2.5 font-semibold">ID</th>
              <th className="px-3 py-2.5 font-semibold">Estado</th>
              <th className="px-3 py-2.5 font-semibold">Título</th>
              <th className="px-3 py-2.5 font-semibold">Creador</th>
              <th className="px-3 py-2.5 font-semibold">Paso borrador</th>
              <th className="px-3 py-2.5 font-semibold">Feedback</th>
              <th className="px-3 py-2.5 font-semibold">Fechas</th>
              <th className="px-3 py-2.5 font-semibold">Enlaces</th>
              <th className="px-3 py-2.5 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.propertyId} className="align-top hover:bg-bg-light/40">
                <td className="px-3 py-2.5">
                  <div className="font-mono font-semibold text-body">{row.shortId}</div>
                  <div className="mt-0.5 text-[10px] text-muted">{row.postMode}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                    {row.assistedDraft ? <AiOriginBadge /> : null}
                  </div>
                </td>
                <td className="max-w-[180px] px-3 py-2.5">
                  <div className="line-clamp-2 font-medium text-body">{row.title || "Sin título"}</div>
                  <div className="mt-0.5 text-muted">
                    {row.neighborhood}, {row.city}
                  </div>
                </td>
                <td className="max-w-[160px] px-3 py-2.5">
                  {row.creatorLoggedIn ? (
                    <>
                      <div className="font-medium text-body">{row.creatorDisplayName || "Usuario"}</div>
                      <div className="break-all text-muted">{row.creatorEmail}</div>
                      <div className="mt-0.5 text-[10px] text-primary">Con sesión</div>
                    </>
                  ) : (
                    <div className="text-muted">Sin sesión aún</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-body">
                  {row.status === "draft" ? (
                    row.wizardStepLabel ? (
                      <>
                        <div className="font-medium">{row.wizardStepLabel}</div>
                        <div className="text-muted">Paso {(row.wizardStep ?? 0) + 1}</div>
                      </>
                    ) : (
                      "—"
                    )
                  ) : (
                    <span className="text-muted">Completado</span>
                  )}
                </td>
                <td className="max-w-[160px] px-3 py-2.5">
                  {row.feedbackCompleted ? (
                    <>
                      <div className="font-semibold text-body">
                        {"★".repeat(row.feedbackRating ?? 0)}
                        {"☆".repeat(5 - (row.feedbackRating ?? 0))} {row.feedbackRating}/5
                      </div>
                      {row.feedbackComment ? (
                        <div className="mt-0.5 line-clamp-3 text-muted">{row.feedbackComment}</div>
                      ) : (
                        <div className="mt-0.5 text-muted">Sin comentario</div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted">Sin feedback</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                  <div>Creado: {formatAdminDate(row.createdAt)}</div>
                  <div>Pub: {formatAdminDate(row.publishedAt)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <Link
                      to={row.viewPath}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver post
                    </Link>
                    <Link
                      to={row.editPath}
                      className="text-muted underline-offset-2 hover:underline"
                    >
                      {row.assistedDraft && row.status === "draft" ? "Vista previa IA" : "Editor"}
                    </Link>
                    {row.posthogReplayUrl ? (
                      <a
                        href={row.posthogReplayUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted underline-offset-2 hover:underline"
                      >
                        Replay
                      </a>
                    ) : (
                      <span className="text-muted/60">Sin replay</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <RowActions
                    row={row}
                    busy={busyId === row.propertyId}
                    onStatus={setStatus}
                  />
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted">
                  No hay posts que coincidan con el filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.propertyId} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-mono text-sm font-semibold text-body">{row.shortId}</div>
                <div className="mt-1 font-medium text-body">{row.title || "Sin título"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
                {row.assistedDraft ? <AiOriginBadge /> : null}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted">
              <div>
                <dt className="font-semibold text-body">Creador</dt>
                <dd>
                  {row.creatorLoggedIn
                    ? `${row.creatorDisplayName || "Usuario"} · ${row.creatorEmail || ""}`
                    : "Sin sesión aún"}
                </dd>
              </div>
              {row.status === "draft" ? (
                <div>
                  <dt className="font-semibold text-body">Paso</dt>
                  <dd>{row.wizardStepLabel ?? "—"}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-body">Feedback</dt>
                <dd>
                  {row.feedbackCompleted
                    ? `${row.feedbackRating}/5${row.feedbackComment ? ` · ${row.feedbackComment}` : ""}`
                    : "Sin feedback"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-body">Fechas</dt>
                <dd>
                  Creado {formatAdminDate(row.createdAt)} · Pub {formatAdminDate(row.publishedAt)}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link
                to={row.viewPath}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 font-semibold text-primary"
              >
                Ver post
              </Link>
              <Link
                to={row.editPath}
                className="rounded-full border border-border px-3 py-1.5 font-semibold text-body"
              >
                {row.assistedDraft && row.status === "draft" ? "Vista previa IA" : "Editor"}
              </Link>
              {row.posthogReplayUrl ? (
                <a
                  href={row.posthogReplayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border px-3 py-1.5 font-semibold text-body"
                >
                  Replay
                </a>
              ) : null}
            </div>
            <div className="mt-3">
              <RowActions row={row} busy={busyId === row.propertyId} onStatus={setStatus} />
            </div>
          </li>
        ))}
        {!loading && rows.length === 0 ? (
          <li className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No hay posts que coincidan con el filtro.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function RowActions({
  row,
  busy,
  onStatus,
}: {
  row: AdminPostRow;
  busy: boolean;
  onStatus: (row: AdminPostRow, status: AdminPostStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.status !== "paused" && row.status !== "archived" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatus(row, "paused")}
          className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-body disabled:opacity-50"
          title="Pausar (flag) el anuncio"
        >
          Pausar
        </button>
      ) : null}
      {row.status !== "archived" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatus(row, "archived")}
          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted disabled:opacity-50"
        >
          Archivar
        </button>
      ) : null}
      {row.status === "paused" || row.status === "archived" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatus(row, "published")}
          className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary disabled:opacity-50"
        >
          Publicar
        </button>
      ) : null}
      {row.status === "published" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStatus(row, "draft")}
          className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted disabled:opacity-50"
        >
          A borrador
        </button>
      ) : null}
    </div>
  );
}
