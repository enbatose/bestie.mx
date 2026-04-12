import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchMyListings,
  isListingsApiConfigured,
  updateListingStatus,
} from "@/lib/listingsApi";
import type { ListingStatus, PropertyListing } from "@/types/listing";

function statusLabel(s: ListingStatus | undefined): string {
  switch (s) {
    case "paused":
      return "Pausado";
    case "archived":
      return "Archivado";
    case "draft":
      return "Borrador";
    default:
      return "Publicado";
  }
}

export function MyListingsPage() {
  const apiOn = isListingsApiConfigured();
  const [rows, setRows] = useState<PropertyListing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiOn) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await fetchMyListings();
      setRows(data);
    } catch {
      setErr("No se pudieron cargar tus anuncios.");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [apiOn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pause(id: string) {
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "paused");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo pausar.");
    } finally {
      setActionId(null);
    }
  }

  async function republish(id: string) {
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "published");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo republicar.");
    } finally {
      setActionId(null);
    }
  }

  if (!apiOn) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold text-primary">Mis anuncios</h1>
        <p className="mt-3 text-sm text-muted">
          Configura <code className="rounded bg-surface-elevated px-1 py-0.5 text-xs">VITE_API_URL</code>{" "}
          en tu entorno para ver anuncios vinculados a tu navegador (cookie de publicador).
        </p>
        <p className="mt-6 text-sm">
          <Link to="/publicar" className="font-semibold text-primary underline-offset-2 hover:underline">
            Ir a publicar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mis anuncios</h1>
          <p className="mt-2 text-sm text-muted">
            Solo ves anuncios creados desde este navegador (sesión anónima por cookie).
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-body transition enabled:hover:bg-surface-elevated disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      {err ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-elevated text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Ciudad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-body">
            {busy && rows === null ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Cargando…
                </td>
              </tr>
            ) : rows?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  Aún no hay anuncios asociados a esta sesión.{" "}
                  <Link to="/publicar" className="font-semibold text-primary underline-offset-2 hover:underline">
                    Publicar
                  </Link>
                </td>
              </tr>
            ) : (
              rows?.map((l) => {
                const st = l.status ?? "published";
                const acting = actionId === l.id;
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-medium">{l.title}</td>
                    <td className="px-4 py-3 text-muted">{l.city}</td>
                    <td className="px-4 py-3">{statusLabel(st)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {st === "published" ? (
                          <Link
                            to={`/anuncio/${l.id}`}
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body hover:bg-surface-elevated"
                          >
                            Ver público
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">Oculto del buscador</span>
                        )}
                        {st === "published" ? (
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void pause(l.id)}
                            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                          >
                            {acting ? "…" : "Pausar"}
                          </button>
                        ) : null}
                        {st === "paused" ? (
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => void republish(l.id)}
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body hover:bg-surface-elevated disabled:opacity-50"
                          >
                            {acting ? "…" : "Republicar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-xs text-muted">
        Para pausar o republicar necesitas la misma cookie con la que publicaste.{" "}
        <span className="font-medium">API:</span>{" "}
        <code className="rounded bg-surface-elevated px-1">PATCH /api/listings/:id</code> con{" "}
        <code className="rounded bg-surface-elevated px-1">{"{ \"status\" }"}</code>.
      </p>
    </div>
  );
}
