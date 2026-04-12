import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminAnalyticsSummary,
  adminGetFeaturedCities,
  adminListUsers,
  adminPatchPropertyStatus,
  adminPutFeaturedCities,
  isAuthApiConfigured,
  type AdminUserRow,
} from "@/lib/authApi";

export function AdminPage() {
  const apiOn = isAuthApiConfigured();
  const [tab, setTab] = useState<"users" | "cities" | "analytics" | "property">("users");
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [citiesText, setCitiesText] = useState("");
  const [summary, setSummary] = useState<{ publishedPropertyCount: number; dauPublishersApprox: number; day: string } | null>(
    null,
  );
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

  useEffect(() => {
    if (!apiOn) return;
    void (async () => {
      try {
        await loadUsers();
        await loadCities();
        await loadSummary();
        setErr(null);
      } catch (x) {
        setErr(x instanceof Error ? x.message : "Sin acceso admin (revisa ADMIN_EMAILS en el servidor).");
      }
    })();
  }, [apiOn, loadUsers, loadCities, loadSummary]);

  if (!apiOn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold text-primary">Admin</h1>
        <p className="mt-2 text-sm text-muted">Configura VITE_API_URL.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-primary">Administración</h1>
      <p className="mt-2 text-sm text-muted">
        Solo cuentas listadas en <span className="font-mono">ADMIN_EMAILS</span>. No hay impersonación
        {apiOn ? (
          <>
            :{" "}
            <a
              href={`${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api/compliance/no-impersonation`}
              className="font-medium text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              política JSON
            </a>
            .
          </>
        ) : (
          "."
        )}
      </p>

      {err ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</p>
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
                setErr(x instanceof Error ? x.message : "Error");
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
        <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
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
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => void loadSummary().catch(() => null)}
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
          <button
            type="button"
            disabled={busy || !propId}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await adminPatchPropertyStatus(propId, propStatus);
              } catch (x) {
                setErr(x instanceof Error ? x.message : "Error");
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
