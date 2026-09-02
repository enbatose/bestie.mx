import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, useParams, useSearchParams } from "react-router-dom";
import { publishWizardEditPath } from "@/lib/listingReference";
import {
  adminAnalyticsSummary,
  adminFetchSupportThread,
  adminGetFeaturedCities,
  adminListSupportConversations,
  adminNavCounts,
  adminPatchPropertyStatus,
  adminPutFeaturedCities,
  adminReplySupportThread,
  adminStreetViewAnalytics,
  adminImageUploadAnalytics,
  adminUsageAnalytics,
  type AdminNavCounts,
  type AdminStreetViewAnalytics,
  type AdminImageUploadAnalytics,
  type AdminUsageAnalytics,
  type AdminSupportConversationRow,
  type AdminSupportThread,
} from "@/lib/authApi";
import { apiBase } from "@/lib/apiBase";
import {
  ADMIN_SUPPORT_KIND_FILTER_OPTIONS,
  ADMIN_SUPPORT_SORT_OPTIONS,
  formatRelativeUpdatedAt,
  sortAdminSupportConversations,
  type AdminSupportKindFilter,
  type AdminSupportSortKey,
} from "@/lib/conversationInbox";
import { AttachmentPicker } from "@/components/messaging/AttachmentPicker";
import { ChatMessageBody } from "@/components/messaging/ChatMessageBody";
import { MessageAttachmentList } from "@/components/messaging/MessageAttachmentList";
import { uploadMessageAttachment, type MessageAttachment } from "@/lib/messagesApi";
import { AdminPostsPanel } from "@/components/admin/AdminPostsPanel";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { AdminReportActions } from "@/components/admin/AdminReportActions";
import { AdminFraudReportChecklist } from "@/components/admin/AdminFraudReportChecklist";
import { AdminAssistedDraftPanel } from "@/components/admin/AdminAssistedDraftPanel";
import { AdminBlogPanel } from "@/components/admin/AdminBlogPanel";
import { AdminArcoPanel } from "@/components/admin/AdminArcoPanel";
import { ADMIN_DEFAULT_PATH, ADMIN_NAV_SECTIONS, parseAdminSectionSlug } from "@/lib/adminSections";

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

function formatCategoryLabel(key: string): string {
  const map: Record<string, string> = {
    email_verification: "Verificación de email",
    password_reset: "Reset de contraseña",
    saved_search: "Búsqueda guardada",
    message_digest: "Digest de mensajes",
    backup_alert: "Alerta de respaldo",
    new_post_alert: "Alerta de anuncio nuevo",
    inbound_forward_alert: "Alerta reenvío inbound",
    uncategorized: "Sin categoría",
    contacto_forward: "Contacto (reenviado)",
    inbound_other: "Inbound (otros)",
    ok: "Enviado OK",
    fail: "Falló",
    skipped: "Omitido (Meta off)",
    gemini: "Gemini",
    template: "Plantilla (fallback)",
    stored: "Caché / ya guardado",
  };
  return map[key] ?? key;
}

function QuotaBar({ value, limit, warnAt = 80 }: { value: number; limit: number; warnAt?: number }) {
  const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  const warn = pct >= warnAt;
  return (
    <div
      className="mt-2 h-2 overflow-hidden rounded-full bg-surface-elevated"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${warn ? "bg-warning" : "bg-secondary"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiTile({ children }: { children: React.ReactNode }) {
  return (
    <li className="min-w-0 break-words rounded-lg border border-border bg-bg-light px-3 py-2">{children}</li>
  );
}

function DailySparkline({ series }: { series: { day: string; value: number }[] }) {
  const maxVal = Math.max(...series.map((d) => d.value), 1);
  const barW = 10;
  const gap = 3;
  const chartH = 40;
  const w = Math.max(series.length * (barW + gap) - gap, 1);
  const displayW = Math.max(w, 240);
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
      <svg
        viewBox={`0 0 ${w} ${chartH + 14}`}
        width={displayW}
        height={chartH + 14}
        className="max-w-none"
        aria-label="Generaciones diarias"
      >
        {series.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * chartH);
          const x = i * (barW + gap);
          const y = chartH - barH;
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barW} height={barH} rx={2} className="fill-primary/60" />
              <title>{`${d.day}: ${d.value}`}</title>
              <text x={x + barW / 2} y={chartH + 10} textAnchor="middle" fontSize={6} className="fill-muted">
                {d.day.slice(8)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatImageEventTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminPage() {
  const { section: sectionSlug } = useParams<{ section: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedSection = parseAdminSectionSlug(sectionSlug);
  const tab = parsedSection ?? "users";
  const conversationFromUrl = searchParams.get("c")?.trim() || null;
  const [err, setErr] = useState<string | null>(null);
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
  const [supportKindFilter, setSupportKindFilter] = useState<AdminSupportKindFilter>("all");
  const [supportFiltersOpen, setSupportFiltersOpen] = useState(true);
  const [summary, setSummary] = useState<{ publishedPropertyCount: number; dauPublishersApprox: number; day: string } | null>(
    null,
  );
  const [navCounts, setNavCounts] = useState<AdminNavCounts | null>(null);
  const monthChoices = useMemo(() => monthOptions(12), []);
  const [streetViewMonth, setStreetViewMonth] = useState(() => monthChoices[0] ?? new Date().toISOString().slice(0, 7));
  const [streetView, setStreetView] = useState<AdminStreetViewAnalytics | null>(null);
  const [usage, setUsage] = useState<AdminUsageAnalytics | null>(null);
  const [imageUploads, setImageUploads] = useState<AdminImageUploadAnalytics | null>(null);
  const [imageFailuresOnly, setImageFailuresOnly] = useState(true);
  const [propId, setPropId] = useState("");
  const [propStatus, setPropStatus] = useState<"draft" | "published" | "paused" | "archived">("paused");
  const [propOk, setPropOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const loadUsage = useCallback(async (month: string) => {
    setUsage(await adminUsageAnalytics(month));
  }, []);

  const loadImageUploads = useCallback(async (failuresOnly: boolean) => {
    setImageUploads(await adminImageUploadAnalytics({ hours: 48, limit: 60, failuresOnly }));
  }, []);

  const loadNavCounts = useCallback(async () => {
    setNavCounts(await adminNavCounts());
  }, []);

  const loadSupportConversations = useCallback(async (q?: string, kind: AdminSupportKindFilter = "all") => {
    setSupportLoadingList(true);
    try {
      setSupportRows(await adminListSupportConversations({ q, kind }));
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
      await loadSupportConversations(supportDebouncedSearch || undefined, supportKindFilter);
      await loadNavCounts();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo enviar la respuesta.");
    } finally {
      setSupportSending(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadCities();
        await loadSummary();
        await loadNavCounts();
        await loadStreetView(streetViewMonth);
        await loadUsage(streetViewMonth);
        await loadImageUploads(imageFailuresOnly);
        setErr(null);
      } catch (x) {
        setErr(x instanceof Error ? x.message : "Sin acceso admin (revisa ADMIN_EMAILS en el servidor).");
      }
    })();
  }, [loadCities, loadSummary, loadNavCounts, loadStreetView, loadUsage, loadImageUploads, streetViewMonth, imageFailuresOnly]);

  useEffect(() => {
    const t = window.setTimeout(() => setSupportDebouncedSearch(supportSearchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [supportSearchInput]);

  useEffect(() => {
    if (tab === "soporte") void loadSupportConversations(supportDebouncedSearch || undefined, supportKindFilter);
  }, [tab, loadSupportConversations, supportDebouncedSearch, supportKindFilter]);

  useEffect(() => {
    if (tab !== "soporte") return;
    setSupportActiveId(conversationFromUrl);
  }, [tab, conversationFromUrl]);

  const openSupportConversation = useCallback(
    (conversationId: string) => {
      setSearchParams({ c: conversationId }, { replace: true });
    },
    [setSearchParams],
  );

  const closeSupportConversation = useCallback(() => {
    if (!searchParams.has("c")) {
      setSupportActiveId(null);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("c");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (supportActiveId) {
      void loadSupportThread(supportActiveId).then(() => {
        void loadNavCounts();
      });
    }
    setSupportDraft("");
    setSupportFiles([]);
    setSupportAttachErr(null);
  }, [supportActiveId, loadSupportThread, loadNavCounts]);

  const sortedSupportRows = useMemo(
    () => sortAdminSupportConversations(supportRows, supportSortKey),
    [supportRows, supportSortKey],
  );

  const dynamicPct = streetView
    ? Math.min(100, (streetView.dynamicStreetView.total / streetView.dynamicStreetView.freeTierLimit) * 100)
    : 0;

  const clearErr = useCallback((message: string | null) => {
    setErr(message);
  }, []);

  if (!parsedSection) {
    return <Navigate to={ADMIN_DEFAULT_PATH} replace />;
  }

  return (
    <div className={`mx-auto w-full min-w-0 px-4 py-6 sm:px-6 sm:py-14 ${tab === "soporte" || tab === "analytics" || tab === "property" || tab === "blog" ? "max-w-7xl" : "max-w-3xl"}`}>
      <h1 className="text-2xl font-bold text-primary">Administración</h1>
      <p className="mt-2 break-words text-sm text-muted">
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

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 text-sm font-medium [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {ADMIN_NAV_SECTIONS.map((section) => {
          const countKey = "countKey" in section ? section.countKey : null;
          const count = countKey && navCounts ? navCounts[countKey] : null;
          const unreadAlert = countKey === "unreadSupportMessages" && count != null && count > 0;
          return (
            <NavLink
              key={section.id}
              to={`/admin/${section.slug}`}
              title={
                countKey === "verifiedUsers"
                  ? "Usuarios verificados"
                  : countKey === "publishedPosts"
                    ? "Posts publicados"
                    : countKey === "unreadSupportMessages"
                      ? "Mensajes no leídos"
                      : undefined
              }
              aria-label={
                count != null
                  ? `${section.label}, ${count.toLocaleString("es-MX")}`
                  : section.label
              }
              className={({ isActive }) =>
                `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 transition ${
                  isActive ? "bg-primary text-primary-fg" : "border border-border text-body hover:bg-surface-elevated"
                }`
              }
            >
              {section.label}
              {count != null ? (
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`tabular-nums ${
                      unreadAlert
                        ? "rounded-full bg-error px-1.5 py-0.5 text-[11px] font-bold text-white"
                        : "text-[11px] font-semibold opacity-80"
                    }`}
                  >
                    {count.toLocaleString("es-MX")}
                  </span>
                  {countKey === "publishedPosts" &&
                  navCounts?.unreviewedReportedPosts != null &&
                  navCounts.unreviewedReportedPosts > 0 ? (
                    <span className="text-[11px] font-bold text-error">
                      ({navCounts.unreviewedReportedPosts.toLocaleString("es-MX")})
                    </span>
                  ) : null}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </div>

      {tab === "users" ? <AdminUsersPanel onError={clearErr} /> : null}

      {tab === "arco" ? <AdminArcoPanel onError={clearErr} /> : null}

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
        <div className="mt-6 min-w-0 space-y-6">
          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
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

          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-body">Street View — sesiones facturables</h2>
                <p className="mt-1 text-xs text-muted">
                  Editor dinámico (bloqueo de ángulo). Corte mensual UTC.
                </p>
              </div>
              <label className="block w-full text-xs font-medium text-body sm:w-auto">
                Mes
                <select
                  value={streetViewMonth}
                  onChange={(e) => setStreetViewMonth(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-border bg-bg-light px-2 py-1.5 text-sm outline-none ring-accent focus:ring-2 sm:min-h-0 sm:w-auto"
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
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
                    <p className="min-w-0 break-words text-body">
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

                <p className="break-words border-t border-border pt-4 text-xs text-muted">
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

          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-body">Resend — cupo de email</h2>
                <p className="mt-1 text-xs text-muted">
                  Envíos + inbound cuentan al cupo free (100/día, 3,000/mes). Mismo mes UTC que Street View.
                </p>
              </div>
            </div>
            {usage ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
                    <p className="min-w-0 break-words text-body">
                      Mes: <strong>{usage.resend.quotaUnits.toLocaleString("es-MX")}</strong> /{" "}
                      {usage.resend.monthlyLimit.toLocaleString("es-MX")}
                      <span className="mt-1 block text-xs text-muted sm:ml-1 sm:mt-0 sm:inline">
                        (enviados {usage.resend.sent.toLocaleString("es-MX")} + recibidos{" "}
                        {usage.resend.received.toLocaleString("es-MX")})
                      </span>
                    </p>
                    <p className="shrink-0 text-xs text-muted">
                      {usage.monthStart} — {usage.monthEnd}
                    </p>
                  </div>
                  <QuotaBar value={usage.resend.quotaUnits} limit={usage.resend.monthlyLimit} />
                </div>
                <div>
                  <p className="text-body">
                    Hoy: <strong>{usage.resend.today.quotaUnits.toLocaleString("es-MX")}</strong> /{" "}
                    {usage.resend.dailyLimit.toLocaleString("es-MX")}
                  </p>
                  <QuotaBar value={usage.resend.today.quotaUnits} limit={usage.resend.dailyLimit} warnAt={70} />
                </div>
                {Object.keys(usage.resend.byCategory).length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted">
                    {Object.entries(usage.resend.byCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <li key={k}>
                          {formatCategoryLabel(k)}: {v.toLocaleString("es-MX")}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">Sin envíos registrados este mes (el conteo arranca con este deploy).</p>
                )}
                <p className="break-words border-t border-border pt-4 text-xs text-muted">
                  Verificado {usage.resend.pricing.lastVerified}.{" "}
                  <a
                    href={usage.resend.pricing.sourceUrl}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Cuotas Resend
                  </a>
                  . {usage.resend.pricing.note}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando Resend…</p>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div>
              <h2 className="font-semibold text-body">Gemini — textos para compartir</h2>
              <p className="mt-1 text-xs text-muted">
                Generaciones de copy de anuncio (Google AI). Cache hits no llaman al API.
              </p>
            </div>
            {usage ? (
              <div className="mt-4 space-y-3">
                <ul className="grid grid-cols-1 gap-2 text-body sm:grid-cols-3">
                  <KpiTile>
                    Llamadas Gemini: <strong>{usage.gemini.calls.toLocaleString("es-MX")}</strong>
                  </KpiTile>
                  <KpiTile>
                    Tokens:{" "}
                    <span className="inline-block">
                      <strong>{usage.gemini.promptTokens.toLocaleString("es-MX")}</strong> in
                    </span>{" "}
                    /{" "}
                    <span className="inline-block">
                      <strong>{usage.gemini.outputTokens.toLocaleString("es-MX")}</strong> out
                    </span>
                  </KpiTile>
                  <KpiTile>
                    Costo est.: <strong>{formatUsd(usage.gemini.estimatedUsd)}</strong>
                  </KpiTile>
                </ul>
                <ul className="space-y-1 text-xs text-muted">
                  <li>
                    {formatCategoryLabel("template")}: {usage.gemini.templateFallback.toLocaleString("es-MX")}
                  </li>
                  <li>
                    {formatCategoryLabel("stored")}: {usage.gemini.storedCacheHits.toLocaleString("es-MX")}
                  </li>
                </ul>
                <p className="break-words border-t border-border pt-4 text-xs text-muted">
                  Verificado {usage.gemini.pricing.lastVerified}.{" "}
                  <a
                    href={usage.gemini.pricing.sourceUrl}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Gemini pricing
                  </a>{" "}
                  (${usage.gemini.pricing.inputUsdPer1M}/1M in · ${usage.gemini.pricing.outputUsdPer1M}/1M out).{" "}
                  {usage.gemini.pricing.note}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando Gemini…</p>
            )}
          </div>

          {/* ── Gemini: AI Post Generation ── */}
          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div>
              <h2 className="font-semibold text-body">Gemini — generación de anuncios</h2>
              <p className="mt-1 text-xs text-muted">
                Costo del flujo AI de creación de post (admin outreach). Un "llamada" = una extracción Gemini.
              </p>
            </div>
            {usage ? (
              <div className="mt-4 space-y-4">
                {/* KPI grid */}
                <ul className="grid grid-cols-1 gap-2 text-body sm:grid-cols-2 lg:grid-cols-4">
                  <KpiTile>
                    Generaciones:{" "}
                    <strong>{(usage.assistedDraft?.calls ?? 0).toLocaleString("es-MX")}</strong>
                  </KpiTile>
                  <KpiTile>
                    Tokens:{" "}
                    <span className="inline-block">
                      <strong>{(usage.assistedDraft?.promptTokens ?? 0).toLocaleString("es-MX")}</strong> in
                    </span>{" "}
                    /{" "}
                    <span className="inline-block">
                      <strong>{(usage.assistedDraft?.outputTokens ?? 0).toLocaleString("es-MX")}</strong> out
                    </span>
                  </KpiTile>
                  <KpiTile>
                    Costo mensual:{" "}
                    <strong>{formatUsd(usage.assistedDraft?.estimatedUsd ?? 0)}</strong>
                  </KpiTile>
                  <KpiTile>
                    Costo promedio / generación:{" "}
                    <strong>{formatUsd(usage.assistedDraft?.avgUsdPerCall ?? 0)}</strong>
                  </KpiTile>
                </ul>

                {/* Daily sparkline */}
                {(usage.assistedDraft?.dailyCalls?.length ?? 0) > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted">Generaciones por día este mes</p>
                    <DailySparkline series={usage.assistedDraft?.dailyCalls ?? []} />
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Sin datos en este mes. Se empieza a registrar cuando el admin usa "Outreach AI".
                  </p>
                )}

                {/* Model breakdown */}
                {Object.keys(usage.assistedDraft?.byModel ?? {}).length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted">
                    {Object.entries(usage.assistedDraft.byModel).map(([model, count]) => (
                      <li key={model} className="break-all">
                        {model}: {(count as number).toLocaleString("es-MX")} llamadas
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className="break-words border-t border-border pt-3 text-xs text-muted">
                  Verificado {usage.assistedDraft?.pricing?.lastVerified ?? "—"}.{" "}
                  <a
                    href={usage.assistedDraft?.pricing?.sourceUrl}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Gemini pricing
                  </a>{" "}
                  (${usage.assistedDraft?.pricing?.inputUsdPer1M}/1M in · $
                  {usage.assistedDraft?.pricing?.outputUsdPer1M}/1M out). Estimado — reconciliar con Google AI / GCP billing.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando…</p>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div>
              <h2 className="font-semibold text-body">PostHog — analytics y session replay</h2>
              <p className="mt-1 text-xs text-muted">
                Solo Prod captura (bestie.mx). Free tier: 5,000 recordings + 1M eventos/mes.
              </p>
            </div>
            {usage ? (
              <div className="mt-4 space-y-4">
                {!usage.posthog.configured ? (
                  <p className="break-words text-sm text-muted">
                    Configura{" "}
                    <code className="break-all rounded bg-bg-light px-1.5 py-0.5">POSTHOG_PERSONAL_API_KEY</code>{" "}
                    en el servicio API (Railway) con scope de query. Crea la key en{" "}
                    <a
                      href="https://us.posthog.com/settings/user-api-keys"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Personal API keys
                    </a>
                    .
                  </p>
                ) : !usage.posthog.available ? (
                  <p className="break-words text-sm text-error">
                    No se pudo consultar PostHog{usage.posthog.error ? `: ${usage.posthog.error}` : "."}
                  </p>
                ) : (
                  <>
                    <div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
                        <p className="min-w-0 break-words text-body">
                          Recordings:{" "}
                          <strong>{usage.posthog.recordings.total.toLocaleString("es-MX")}</strong> /{" "}
                          {usage.posthog.recordings.freeTierLimit.toLocaleString("es-MX")}
                        </p>
                        <p className="text-xs text-muted">
                          Excedente est.: {formatUsd(usage.posthog.recordings.estimatedOverageUsd)}
                        </p>
                      </div>
                      <QuotaBar
                        value={usage.posthog.recordings.total}
                        limit={usage.posthog.recordings.freeTierLimit}
                      />
                    </div>
                    <div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between">
                        <p className="min-w-0 break-words text-body">
                          Eventos: <strong>{usage.posthog.events.total.toLocaleString("es-MX")}</strong> /{" "}
                          {usage.posthog.events.freeTierLimit.toLocaleString("es-MX")}
                        </p>
                        <p className="text-xs text-muted">
                          Personas únicas: {usage.posthog.events.uniquePersons.toLocaleString("es-MX")}
                          <span className="mt-0.5 block sm:mt-0 sm:inline">
                            {" "}
                            · Excepciones: {usage.posthog.exceptions.total.toLocaleString("es-MX")}
                          </span>
                        </p>
                      </div>
                      <QuotaBar
                        value={usage.posthog.events.total}
                        limit={usage.posthog.events.freeTierLimit}
                        warnAt={90}
                      />
                    </div>
                  </>
                )}
                <p className="break-words border-t border-border pt-4 text-xs text-muted">
                  Verificado {usage.posthog.pricing.lastVerified}.{" "}
                  <a
                    href={usage.posthog.links.billing}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Billing
                  </a>
                  {" · "}
                  <a
                    href={usage.posthog.links.replayHome}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Replay
                  </a>
                  {" · "}
                  <a
                    href={usage.posthog.pricing.sourceUrl}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Pricing
                  </a>
                  . {usage.posthog.pricing.note}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando PostHog…</p>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div>
              <h2 className="font-semibold text-body">WhatsApp OTP + almacenamiento</h2>
              <p className="mt-1 text-xs text-muted">Meta Cloud API (OTP) y fotos en SQLite (`upload_blobs`).</p>
            </div>
            {usage ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-body">
                    Retos OTP creados (mes):{" "}
                    <strong>{usage.whatsappOtp.challengesCreated.toLocaleString("es-MX")}</strong>
                  </p>
                  {usage.whatsappOtp.trackedSends > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {Object.entries(usage.whatsappOtp.byResult).map(([k, v]) => (
                        <li key={k}>
                          {formatCategoryLabel(k)}: {v.toLocaleString("es-MX")}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted">{usage.whatsappOtp.note}</p>
                  )}
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-body">
                    Blobs de fotos: <strong>{usage.storage.blobCount.toLocaleString("es-MX")}</strong> ·{" "}
                    <strong>{usage.storage.totalBytesLabel}</strong>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Tamaño en Railway volume / DB. No incluye bucket de respaldos S3.
                  </p>
                </div>
                {usage.notes.length > 0 ? (
                  <ul className="space-y-1 border-t border-border pt-4 text-xs text-muted">
                    {usage.notes.map((n) => (
                      <li key={n} className="break-words">
                        • {n}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando…</p>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-border bg-surface p-3 text-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-body">Subida de fotos — auditoría</h2>
                <p className="mt-1 break-words text-xs text-muted">
                  Eventos `image_pipeline` de las últimas {imageUploads?.windowHours ?? 48} h (convert / upload /
                  persist). Sin nombres de archivo completos.
                </p>
              </div>
              <label className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-body">
                <input
                  type="checkbox"
                  checked={imageFailuresOnly}
                  onChange={(e) => setImageFailuresOnly(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                Solo fallos
              </label>
            </div>

            {imageUploads ? (
              <div className="mt-4 space-y-4">
                <ul className="grid grid-cols-1 gap-2 text-body sm:grid-cols-3">
                  <KpiTile>
                    Ventana: <strong>{imageUploads.summary.ok}</strong> ok /{" "}
                    <strong className="text-error">{imageUploads.summary.fail}</strong> fail
                  </KpiTile>
                  <KpiTile>
                    Hoy: <strong>{imageUploads.today.ok}</strong> ok /{" "}
                    <strong className="text-error">{imageUploads.today.fail}</strong> fail
                  </KpiTile>
                  <KpiTile>
                    Fail rate móvil:{" "}
                    <strong>
                      {imageUploads.summary.mobileFailRate == null
                        ? "—"
                        : `${Math.round(imageUploads.summary.mobileFailRate * 100)}%`}
                    </strong>
                  </KpiTile>
                </ul>

                {Object.keys(imageUploads.summary.byErrorCode).length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Errores (ventana)</h3>
                    <ul className="mt-2 space-y-1 text-xs text-body">
                      {Object.entries(imageUploads.summary.byErrorCode)
                        .sort((a, b) => b[1] - a[1])
                        .map(([code, n]) => (
                          <li key={code}>
                            <code className="break-all rounded bg-bg-light px-1.5 py-0.5">{code}</code>: {n}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                {Object.keys(imageUploads.summary.bySource).length > 0 ? (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Por origen</h3>
                    <ul className="mt-2 space-y-1 text-xs text-body">
                      {Object.entries(imageUploads.summary.bySource).map(([src, v]) => (
                        <li key={src}>
                          {src}: {v.ok} ok / {v.fail} fail
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {imageUploads.events.length === 0 ? (
                  <p className="border-t border-border pt-4 text-xs text-muted sm:hidden">
                    Sin eventos en la ventana.
                  </p>
                ) : (
                  <ul className="space-y-2 border-t border-border pt-4 sm:hidden">
                    {imageUploads.events.map((ev) => (
                      <li key={ev.id} className="rounded-lg border border-border bg-bg-light p-3 text-xs text-body">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="font-medium">
                            {formatImageEventTime(ev.createdAt)}
                            {ev.mobileLike ? (
                              <span className="ml-1 rounded bg-secondary/20 px-1 text-[10px]">móvil</span>
                            ) : null}
                          </span>
                          <span className={ev.ok ? "text-body" : "font-semibold text-error"}>
                            {ev.step ?? "—"} · {ev.ok ? "ok" : "fail"}
                          </span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-muted">
                          <div className="min-w-0">
                            <dt className="font-semibold text-body">Origen</dt>
                            <dd className="break-all">{ev.source ?? "—"}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="font-semibold text-body">Código</dt>
                            <dd className="break-all font-mono">{ev.errorCode ?? "—"}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="font-semibold text-body">MIME</dt>
                            <dd className="break-all">
                              {(ev.sniffedMime || ev.declaredMime || "—").replace("image/", "")}
                              {ev.nameExt ? ` .${ev.nameExt}` : ""}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="font-semibold text-body">Decode</dt>
                            <dd className="break-all">{ev.decodePath ?? "—"}</dd>
                          </div>
                          <div className="col-span-2 min-w-0">
                            <dt className="font-semibold text-body">Detalle</dt>
                            <dd className="break-words">
                              {ev.error ?? (ev.ms != null ? `${Math.round(ev.ms)} ms` : "—")}
                            </dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="hidden overflow-x-auto border-t border-border pt-4 sm:block">
                  <table className="min-w-[640px] w-full text-left text-xs">
                    <thead className="text-muted">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">Hora</th>
                        <th className="py-1 pr-3 font-semibold">Paso</th>
                        <th className="py-1 pr-3 font-semibold">Origen</th>
                        <th className="py-1 pr-3 font-semibold">Código</th>
                        <th className="py-1 pr-3 font-semibold">MIME</th>
                        <th className="py-1 pr-3 font-semibold">Decode</th>
                        <th className="py-1 pr-3 font-semibold">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="text-body">
                      {imageUploads.events.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-3 text-muted">
                            Sin eventos en la ventana.
                          </td>
                        </tr>
                      ) : (
                        imageUploads.events.map((ev) => (
                          <tr key={ev.id} className="border-t border-border/60 align-top">
                            <td className="whitespace-nowrap py-1.5 pr-3">
                              {formatImageEventTime(ev.createdAt)}
                              {ev.mobileLike ? (
                                <span className="ml-1 rounded bg-secondary/20 px-1 text-[10px]">móvil</span>
                              ) : null}
                            </td>
                            <td className="py-1.5 pr-3">
                              {ev.step ?? "—"}{" "}
                              <span className={ev.ok ? "text-body" : "text-error"}>{ev.ok ? "ok" : "fail"}</span>
                            </td>
                            <td className="py-1.5 pr-3">{ev.source ?? "—"}</td>
                            <td className="py-1.5 pr-3">
                              <code>{ev.errorCode ?? "—"}</code>
                            </td>
                            <td className="py-1.5 pr-3">
                              {(ev.sniffedMime || ev.declaredMime || "—").replace("image/", "")}
                              {ev.nameExt ? ` .${ev.nameExt}` : ""}
                            </td>
                            <td className="py-1.5 pr-3">{ev.decodePath ?? "—"}</td>
                            <td className="max-w-[14rem] truncate py-1.5 pr-3" title={ev.error ?? undefined}>
                              {ev.error ?? (ev.ms != null ? `${Math.round(ev.ms)} ms` : "—")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-muted">Cargando subidas de fotos…</p>
            )}
          </div>

          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => {
              void loadSummary().catch(() => null);
              void loadStreetView(streetViewMonth).catch(() => null);
              void loadImageUploads(imageFailuresOnly).catch(() => null);
            }}
          >
            Actualizar
          </button>
        </div>
      ) : null}

      {tab === "property" ? (
        <div>
          <p className="mt-2 text-sm text-muted">
            Todos los posts (publicados y borradores). Busca por cualquier columna, pagina el reporte y
            pausa o archiva desde cada fila. Como admin puedes abrir posts no publicados.
          </p>
          <AdminPostsPanel onError={clearErr} onStatusChanged={() => void loadNavCounts()} />
          <div className="mt-8 space-y-3 rounded-xl border border-dashed border-border bg-surface/60 p-4">
            <h2 className="text-sm font-semibold text-body">Cambio rápido por ID</h2>
            <label className="block text-sm font-medium text-body">
              ID o código corto
              <input
                value={propId}
                onChange={(e) => {
                  setPropId(e.target.value.trim());
                  setPropOk(null);
                }}
                placeholder="A5DFC4CCA · P550E8400 · prp__…"
                className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 font-mono text-sm outline-none ring-accent focus:ring-2"
              />
              <span className="mt-1 block text-xs font-normal text-muted">
                Acepta código de anuncio (A…), de propiedad (P…) o id canónico (prp__).
              </span>
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
            {propOk ? <p className="text-sm text-primary">{propOk}</p> : null}
            {propId ? (
              <Link
                to={publishWizardEditPath(propId)}
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
                setPropOk(null);
                try {
                  const result = await adminPatchPropertyStatus(propId, propStatus);
                  setPropId(result.propertyId);
                  setPropOk(`Listo: ${result.propertyId} → ${result.status}`);
                  void loadNavCounts();
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
        </div>
      ) : null}

      {tab === "soporte" ? (
        <div className="mt-6 space-y-4">
          <AdminFraudReportChecklist />
        <div className="grid min-h-[min(70vh,640px)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <aside
            className={`flex min-h-0 flex-col rounded-2xl border border-border bg-surface p-3 shadow-sm ${
              supportActiveId ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Soporte y Feedback</h2>
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
                  onClick={() => void loadSupportConversations(supportDebouncedSearch || undefined, supportKindFilter)}
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
                    Tipo
                  </span>
                  <select
                    value={supportKindFilter}
                    onChange={(e) => setSupportKindFilter(e.target.value as AdminSupportKindFilter)}
                    className="min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
                  >
                    {ADMIN_SUPPORT_KIND_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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
                  : "Sin conversaciones de soporte o feedback todavía."}
              </p>
            ) : (
              <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto md:max-h-[70vh]">
                {sortedSupportRows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openSupportConversation(row.id)}
                      className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        row.id === supportActiveId
                          ? "bg-secondary/15 ring-1 ring-secondary/40"
                          : "hover:bg-surface-elevated"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-body">
                          <span className="truncate">{row.customerDisplayName}</span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                              row.kind === "feedback"
                                ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                : row.kind === "blog"
                                  ? "bg-secondary/25 text-primary"
                                  : "bg-primary/10 text-primary"
                            }`}
                          >
                            {row.kind === "feedback"
                              ? "Feedback"
                              : row.kind === "blog"
                                ? "Blog"
                                : row.kind === "report"
                                  ? "Reporte"
                                  : "Soporte"}
                          </span>
                        </span>
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
                <div
                  className={`border-b border-border px-4 py-3 text-primary-fg ${
                    supportThread?.kind === "feedback"
                      ? "bg-amber-700"
                      : supportThread?.kind === "report"
                        ? "bg-error"
                        : "bg-primary"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={closeSupportConversation}
                      className="mt-0.5 shrink-0 rounded-full border border-primary-fg/30 px-3 py-1 text-xs font-semibold text-primary-fg md:hidden"
                    >
                      Volver
                    </button>
                    <div className="ph-no-capture min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary-fg/80">
                        {supportThread?.kind === "feedback"
                          ? "Feedback"
                          : supportThread?.kind === "blog"
                            ? "Blog"
                            : supportThread?.kind === "report"
                              ? "Reporte"
                              : "Soporte"} ·{" "}
                        {supportThread?.customer?.displayName ?? "…"} ·{" "}
                        {supportThread?.customer?.email ?? "sin correo"}
                      </p>
                      <p className="text-sm font-semibold">{supportThread?.subject ?? "…"}</p>
                    </div>
                  </div>
                </div>

                {supportThread?.kind === "report" && supportActiveId ? (
                  <AdminReportActions
                    conversationId={supportActiveId}
                    onRefreshThread={() => {
                      if (supportActiveId) void openSupportConversation(supportActiveId);
                    }}
                  />
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto p-4">
                    {supportLoadingThread ? (
                      <p className="text-sm text-muted">Cargando mensajes…</p>
                    ) : supportThread && supportThread.messages.length === 0 ? (
                      <p className="text-sm text-muted">
                        Aún no hay mensajes. Escribe abajo para iniciar el chat. La persona lo verá en Mensajes
                        como “Soporte de Bestie”.
                      </p>
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
                          {m.body ? (
                            <ChatMessageBody
                              body={m.body}
                              className="text-sm"
                              linkClassName={
                                m.senderIsCustomer
                                  ? "font-semibold text-primary underline underline-offset-2"
                                  : "font-semibold underline underline-offset-2"
                              }
                            />
                          ) : null}
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
                        placeholder={
                          supportThread?.kind === "feedback"
                            ? "Responder como Feedback de Bestie…"
                            : supportThread?.messages.length === 0
                              ? "Escribe el primer mensaje…"
                              : "Responder como Soporte de Bestie…"
                        }
                        disabled={supportSending}
                        autoFocus={Boolean(supportThread && supportThread.messages.length === 0)}
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
                      onClick={closeSupportConversation}
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
        </div>
      ) : null}

      {tab === "outreach" ? (
        <div className="mt-6">
          <AdminAssistedDraftPanel />
        </div>
      ) : null}

      {tab === "blog" ? <AdminBlogPanel /> : null}

      <p className="mt-10 text-sm text-muted">
        <Link to="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          Inicio
        </Link>
      </p>
    </div>
  );
}
