import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminAnalyticsSummary,
  adminGetFeaturedCities,
  adminListUsers,
  adminPatchPropertyStatus,
  adminPutFeaturedCities,
  adminStreetViewAnalytics,
  type AdminStreetViewAnalytics,
  type AdminUserRow,
} from "@/lib/authApi";
import { apiBase } from "@/lib/apiBase";

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
  const [tab, setTab] = useState<"users" | "cities" | "analytics" | "property">("users");
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [citiesText, setCitiesText] = useState("");
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

  const dynamicPct = streetView
    ? Math.min(100, (streetView.dynamicStreetView.total / streetView.dynamicStreetView.freeTierLimit) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
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
        {(["users", "cities", "analytics", "property"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 transition ${
              tab === t ? "bg-primary text-primary-fg" : "border border-border text-body hover:bg-surface-elevated"
            }`}
          >
            {t === "users" ? "Usuarios" : t === "cities" ? "Ciudades" : t === "analytics" ? "Métricas" : "Propiedad"}
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

      <p className="mt-10 text-sm text-muted">
        <Link to="/" className="font-semibold text-primary underline-offset-2 hover:underline">
          Inicio
        </Link>
      </p>
    </div>
  );
}
