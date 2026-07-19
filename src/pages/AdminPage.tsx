import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminAnalyticsSummary,
  adminFetchSupportThread,
  adminGetFeaturedCities,
  adminListSupportConversations,
  adminListUsers,
  adminPatchPropertyStatus,
  adminPutFeaturedCities,
  adminReplySupportThread,
  adminStreetViewAnalytics,
  type AdminStreetViewAnalytics,
  type AdminSupportConversationRow,
  type AdminSupportThread,
  type AdminUserRow,
} from "@/lib/authApi";
import { apiBase } from "@/lib/apiBase";
import {
  ADMIN_SUPPORT_SORT_OPTIONS,
  formatRelativeUpdatedAt,
  sortAdminSupportConversations,
  type AdminSupportSortKey,
} from "@/lib/conversationInbox";
import { AttachmentPicker } from "@/components/messaging/AttachmentPicker";
import { MessageAttachmentList } from "@/components/messaging/MessageAttachmentList";
import { uploadMessageAttachment, type MessageAttachment } from "@/lib/messagesApi";

function monthOptions(count = 12): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

function interfaceLabel(key: string): string {
  if (key === "publish_wizard") return "Asistente de publicación";
  if (key === "listing_preview") return "Vista previa";
  if (key === "public_listing") return "Anuncio público";
  return key || "Sin interfaz";
}

function formatUsd(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "cities" | "analytics" | "property" | "soporte">("users");
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [citiesText, setCitiesText] = useState("");
  const [supportRows, setSupportRows] = useState<AdminSupportConversationRow[]>([]);
  const [supportActiveId, setSupportActiveId] = useState<string | null>(null);
  const [supportThread, setSupportThread] = useState<AdminSupportThread | null>(null);
  const [supportDraft, setSupportDraft] = useState("");
  const [supportFiles, setSupportFiles] = useState<File[]>([]);
  const [supportAttachErr, setSupportAttachErr] = useState<string | null>(null);
  const [supportLoadingList, setSupportLoadingList] = useState(false);
  const [supportLoadingThread, setSupportLoadingThread] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportSearchInput, setSupportSearchInput] = useState("");
  const [supportDebouncedSearch, setSupportDebouncedSearch] = useState("");
  const [supportSortKey, setSupportSortKey] = useState<AdminSupportSortKey>("updated");
  const [supportFiltersOpen, setSupportFiltersOpen] = useState(true);
  const [summary, setSummary] = useState<{ publishedPropertyCount: number; dauPublishersApprox: number; day: string } | null>(
    null,
  );
  const monthChoices = useMemo(() => monthOptions(12), []);
  const [streetViewMonth, setStreetViewMonth] = useState(() => monthChoices[0] ?? new Date().toISOString().slice(0, 7));
  const [streetView, setStreetView] = useState<AdminStreetViewAnalytics | null>(null);
  const [propId, setPropId] = useState("");
  const [propStatus, setPropStatus] = useState<"draft" | "published" | "paused" | "archived">("paused");
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    const r = await adminListUsers({ limit: 50 });
    setUsers(r.users);
    setTotalUsers(r.total);
  }, []);

  const loadCities = useCallback(async () => {
    const c = await adminGetFeaturedCities();
    setCitiesText(c.join("\n"));
  }, []);

  const loadSummary = useCallback(async () => {
    setSummary(await adminAnalyticsSummary());
  }, []);

  const loadStreetView = useCallback(async (month: string) => {
    setStreetView(await adminStreetViewAnalytics(month));
  }, []);

  const loadSupportConversations = useCallback(async (q?: string) => {
    setSupportLoadingList(true);
    try {
      setSupportRows(await adminListSupportConversations({ q }));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo cargar Soporte al Cliente.");
    } finally {
      setSupportLoadingList(false);
    }
  }, []);

  const loadSupportThread = useCallback(async (conversationId: string) => {
    setSupportLoadingThread(true);
    try {
      setSupportThread(await adminFetchSupportThread(conversationId));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo cargar la conversación.");
      setSupportThread(null);
    } finally {
      setSupportLoadingThread(false);
    }
  }, []);

  const sendSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportActiveId || (!supportDraft.trim() && supportFiles.length === 0)) return;
    setSupportSending(true);
    setErr(null);
    try {
      const attachments: MessageAttachment[] = [];
      for (const file of supportFiles) {
        attachments.push(await uploadMessageAttachment(file));
      }
      await adminReplySupportThread(supportActiveId, supportDraft.trim(), attachments);
      setSupportDraft("");
      setSupportFiles([]);
      await loadSupportThread(supportActiveId);
      await loadSupportConversations(supportDebouncedSearch || undefined);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo enviar la respuesta.");
    } finally {
      setSupportSending(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadUsers();
        await loadCities();
        await loadSummary();
        await loadStreetView(streetViewMonth);
        setErr(null);
      } catch (x) {
        setErr(x instanceof Error ? x.message : "Sin acceso admin (revisa ADMIN_EMAILS en el servidor).");
      }
    })();
  }, [loadUsers, loadCities, loadSummary, loadStreetView, streetViewMonth]);

  useEffect(() => {
    const t = window.setTimeout(() => setSupportDebouncedSearch(supportSearchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [supportSearchInput]);

  useEffect(() => {
    if (tab === "soporte") void loadSupportConversations(supportDebouncedSearch || undefined);
  }, [tab, loadSupportConversations, supportDebouncedSearch]);

  useEffect(() => {
    if (supportActiveId) void loadSupportThread(supportActiveId);
    setSupportDraft("");
    setSupportFiles([]);
    setSupportAttachErr(null);
  }, [supportActiveId, loadSupportThread]);

  const sortedSupportRows = useMemo(
    () => sortAdminSupportConversations(supportRows, supportSortKey),
    [supportRows, supportSortKey],
  );

  const dynamicPct = streetView
    ? Math.min(100, (streetView.dynamicStreetView.total / streetView.dynamicStreetView.freeTierLimit) * 100)
    : 0;

  return (
    <div className={`mx-auto px-4 py-10 sm:px-6 sm:py-14 ${tab === "soporte" ? "max-w-5xl" : "max-w-3xl"}`}>
      <h1 className="text-2xl font-bold text-primary">Administración</h1>
      <p className="mt-2 text-sm text-muted">
        Solo cuentas cuyo correo está en la lista de administradores del servidor (integrada +{" "}
        <span className="font-mono">ADMIN_EMAILS</span>). No hay impersonación:{" "}
        <a
          href={`${apiBase()}/api/compliance/no-impersonation`}
          className="font-medium text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          política JSON
        </a>
        .
      </p>

      {err ? (
        <p className="mt-4 rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error">{err}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2 text-sm font-medium">
        {(["users", "cities", "analytics", "property", "soporte"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 transition ${
              tab === t ? "bg-primary text-primary-fg" : "border border-border text-body hover:bg-surface-elevated"
            }`}
          >
            {t === "users"
              ? "Usuarios"
              : t === "cities"
                ? "Ciudades"
                : t === "analytics"
                  ? "Métricas"
                  : t === "property"
                    ? "Propiedad"
                    : "Soporte"}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <div className="mt-6">
          <p className="text-sm text-muted">Total: {totalUsers}</p>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {users.map((u) => (
              <li key={u.id} className="px-4 py-3 text-sm">
                <div className="font-medium text-body">{u.displayName}</div>
                <div className="text-xs text-muted">
                  {u.email ?? "sin correo"} · tel …{u.phoneLast4 ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "cities" ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted">Una ciudad por línea (aparecen en inicio si la API está configurada).</p>
          <textarea
            value={citiesText}
            onChange={(e) => setCitiesText(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-border bg-bg-light p-3 font-mono text-sm text-body outline-none ring-accent focus:ring-2"
          />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const cities = citiesText
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                await adminPutFeaturedCities(cities);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      ) : null}

      {tab === "analytics" ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            {summary ? (
              <ul className="space-y-2 text-body">
                <li>
                  Propiedades publicadas: <strong>{summary.publishedPropertyCount}</strong>
                </li>
                <li>
                  DAU publicadores (aprox.): <strong>{summary.dauPublishersApprox}</strong> ({summary.day})
                </li>
              </ul>
            ) : (
              <p className="text-muted">Cargando…</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-body">Street View — sesiones facturables</h2>
                <p className="mt-1 text-xs text-muted">
                  Editor dinámico (bloqueo de ángulo). Corte mensual UTC.
                </p>
              </div>
              <label className="text-xs font-medium text-body">
                Mes
                <select
                  value={streetViewMonth}
                  onChange={(e) => setStreetViewMonth(e.target.value)}
                  className="mt-1 block rounded-lg border border-border bg-bg-light px-2 py-1.5 text-sm outline-none ring-accent focus:ring-2"
                >
                  {monthChoices.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {streetView ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-body">
                      Total: <strong>{streetView.dynamicStreetView.total.toLocaleString("es-MX")}</strong> /{" "}
                      {streetView.dynamicStreetView.freeTierLimit.toLocaleString("es-MX")} gratis
                    </p>
                    <p className="text-xs text-muted">
                      {streetView.monthStart} — {streetView.monthEnd}
                    </p>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-surface-elevated"
                    role="progressbar"
                    aria-valuenow={dynamicPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full ${dynamicPct >= 100 ? "bg-warning" : "bg-secondary"}`}
                      style={{ width: `${dynamicPct}%` }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1 text-body">
                    <li>
                      Excedente facturable: <strong>{streetView.dynamicStreetView.billableOverage.toLocaleString("es-MX")}</strong>
                    </li>
                    <li>
                      Costo estimado (excedente):{" "}
                      <strong>{formatUsd(streetView.dynamicStreetView.estimatedOverageUsd)}</strong>
                    </li>
                  </ul>
                  {Object.keys(streetView.dynamicStreetView.byInterface).length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {Object.entries(streetView.dynamicStreetView.byInterface).map(([k, v]) => (
                        <li key={k}>
                          {interfaceLabel(k)}: {v.toLocaleString("es-MX")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold text-body">Vistas embed con ángulo bloqueado</h3>
                  <p className="mt-1 text-xs text-muted">Maps Embed API — sin costo. Solo operaciones.</p>
                  <p className="mt-2 text-body">
                    Total: <strong>{streetView.lockedEmbedViews.total.toLocaleString("es-MX")}</strong>
                  </p>
                  {Object.keys(streetView.lockedEmbedViews.byInterface).length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {Object.entries(streetView.lockedEmbedViews.byInterface).map(([k, v]) => (
                        <li key={k}>
                          {interfaceLabel(k)}: {v.toLocaleString("es-MX")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <p className="border-t border-border pt-4 text-xs text-muted">
                  Precios verificados {streetView.pricing.lastVerified}. Fuente:{" "}
                  <a
                    href={streetView.pricing.sourceUrl}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Maps Platform pricing
                  </a>{" "}
                  (${streetView.pricing.dynamicStreetViewUsdPer1000}/1,000 sesiones tras el cupo).{" "}
                  {streetView.pricing.note}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando Street View…</p>
            )}
          </div>

          <button
            type="button"
            className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => {
              void loadSummary().catch(() => null);
              void loadStreetView(streetViewMonth).catch(() => null);
            }}
          >
            Actualizar
          </button>
        </div>
      ) : null}

      {tab === "property" ? (
        <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-4">
          <label className="block text-sm font-medium text-body">
            ID de propiedad
            <input
              value={propId}
              onChange={(e) => setPropId(e.target.value.trim())}
              className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 font-mono text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-body">
            Estado
            <select
              value={propStatus}
              onChange={(e) => setPropStatus(e.target.value as typeof propStatus)}
              className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
            </select>
          </label>
          {propId ? (
            <Link
              to={`/publicar?edit=${encodeURIComponent(propId)}`}
              className="inline-flex w-full justify-center rounded-full border border-secondary/60 bg-secondary/15 px-4 py-2 text-center text-sm font-semibold text-primary transition hover:bg-secondary/25 sm:w-auto"
            >
              Abrir en editor de anuncios
            </Link>
          ) : null}
          <button
            type="button"
            disabled={busy || !propId}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await adminPatchPropertyStatus(propId, propStatus);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-fg disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      ) : null}

      {tab === "soporte" ? (
        <div className="mt-6 grid min-h-[min(70vh,640px)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <aside
            className={`flex min-h-0 flex-col rounded-2xl border border-border bg-surface p-3 shadow-sm ${
              supportActiveId ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Soporte al Cliente</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSupportFiltersOpen((v) => !v)}
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                  aria-expanded={supportFiltersOpen}
                >
                  {supportFiltersOpen ? "Ocultar filtros" : "Buscar y ordenar"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadSupportConversations(supportDebouncedSearch || undefined)}
                  className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {supportFiltersOpen ? (
              <div className="mt-3 space-y-2 border-b border-border px-1 pb-3">
                <label className="block">
                  <span className="sr-only">Buscar conversaciones</span>
                  <input
                    type="search"
                    value={supportSearchInput}
                    onChange={(e) => setSupportSearchInput(e.target.value)}
                    placeholder="Buscar usuario, asunto o mensajes…"
                    className="min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Ordenar
                  </span>
                  <select
                    value={supportSortKey}
                    onChange={(e) => setSupportSortKey(e.target.value as AdminSupportSortKey)}
                    className="min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                  >
                    {ADMIN_SUPPORT_SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {supportLoadingList ? (
              <p className="p-3 text-sm text-muted">Cargando…</p>
            ) : sortedSupportRows.length === 0 ? (
              <p className="p-3 text-sm text-muted">
                {supportDebouncedSearch
                  ? "No hay conversaciones que coincidan con tu búsqueda."
                  : "Sin conversaciones de soporte todavía."}
              </p>
            ) : (
              <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto md:max-h-[70vh]">
                {sortedSupportRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSupportActiveId(row.id)}
                      className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        row.id === supportActiveId
                          ? "bg-secondary/15 ring-1 ring-secondary/40"
                          : "hover:bg-surface-elevated"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-body">{row.customerDisplayName}</span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {formatRelativeUpdatedAt(row.updatedAt)}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-xs text-muted">{row.subject}</span>
                      {row.customerEmail ? (
                        <span className="line-clamp-1 text-[11px] text-muted">{row.customerEmail}</span>
                      ) : null}
                      {row.lastPreview ? (
                        <span className="line-clamp-1 text-xs text-muted">{row.lastPreview}</span>
                      ) : null}
                      {row.unreadCount > 0 ? (
                        <span className="mt-1 inline-flex w-fit rounded-full bg-error px-2 py-0.5 text-[10px] font-bold text-white">
                          {row.unreadCount} nuevo{row.unreadCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section
            className={`min-h-[min(70vh,640px)] flex-col rounded-2xl border border-border bg-surface shadow-sm ${
              supportActiveId ? "flex" : "hidden md:flex"
            }`}
          >
            {!supportActiveId ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
                Elige una conversación a la izquierda.
              </div>
            ) : (
              <>
                <div className="border-b border-border bg-primary px-4 py-3 text-primary-fg">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => setSupportActiveId(null)}
                      className="mt-0.5 shrink-0 rounded-full border border-primary-fg/30 px-3 py-1 text-xs font-semibold text-primary-fg md:hidden"
                    >
                      Volver
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary-fg/80">
                        {supportThread?.customer?.displayName ?? "…"} ·{" "}
                        {supportThread?.customer?.email ?? "sin correo"}
                      </p>
                      <p className="text-sm font-semibold">{supportThread?.subject ?? "…"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto p-4">
                    {supportLoadingThread ? (
                      <p className="text-sm text-muted">Cargando mensajes…</p>
                    ) : (
                      supportThread?.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            m.senderIsCustomer
                              ? "mr-auto border border-border bg-bg-light text-body"
                              : "ml-auto bg-primary text-primary-fg"
                          }`}
                        >
                          <p
                            className={`text-[10px] font-semibold ${
                              m.senderIsCustomer ? "text-muted" : "text-primary-fg/80"
                            }`}
                          >
                            {m.senderIsCustomer ? m.senderDisplayName : `Admin: ${m.senderDisplayName}`}
                          </p>
                          {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                          <MessageAttachmentList attachments={m.attachments} />
                          <p
                            className={`mt-1 text-[10px] ${
                              m.senderIsCustomer ? "text-muted" : "text-primary-fg/70"
                            }`}
                          >
                            {new Date(m.createdAt).toLocaleString("es-MX", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={sendSupportReply} className="border-t border-border bg-bg-light p-3">
                    <label className="sr-only" htmlFor="support-reply-body">
                      Responder
                    </label>
                    <div className="flex gap-2">
                      <textarea
                        id="support-reply-body"
                        rows={2}
                        value={supportDraft}
                        onChange={(e) => setSupportDraft(e.target.value)}
                        placeholder="Responder como Soporte de Bestie…"
                        disabled={supportSending}
                        className="min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2 disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={supportSending || (!supportDraft.trim() && supportFiles.length === 0)}
                        className="shrink-0 self-end rounded-full bg-secondary px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"
                      >
                        {supportSending ? "Enviando…" : "Enviar"}
                      </button>
                    </div>
                    <AttachmentPicker
                      files={supportFiles}
                      onFilesChange={setSupportFiles}
                      disabled={supportSending}
                      onError={setSupportAttachErr}
                      className="mt-2"
                    />
                    {supportAttachErr ? <p className="mt-1 text-xs text-error">{supportAttachErr}</p> : null}
                    <p className="mt-2 text-[11px] text-muted">
                      El usuario verá tu respuesta como “Soporte de Bestie”, sin tu identidad de admin.
                    </p>
                  </form>
                  <div className="border-t border-border p-3 md:hidden">
                    <button
                      type="button"
                      onClick={() => setSupportActiveId(null)}
                      className="w-full min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <p className="mt-10 text-sm text-muted">
        <Link to="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          Inicio
        </Link>
      </p>
    </div>
  );
}
