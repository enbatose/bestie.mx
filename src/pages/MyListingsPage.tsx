import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  fetchMyListings,
  isListingsApiConfigured,
  updateListingStatus,
  updateProperty,
  fetchPropertyWithRooms,
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

function propertyStatusLabel(s: ListingStatus | undefined): string {
  switch (s) {
    case "draft":
      return "Propiedad: borrador";
    case "paused":
      return "Propiedad: pausada";
    case "archived":
      return "Propiedad: archivada";
    default:
      return "Propiedad: publicada";
  }
}

export function MyListingsPage() {
  const apiOn = isListingsApiConfigured();
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState<PropertyListing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionPropertyId, setActionPropertyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [legalPublishByProperty, setLegalPublishByProperty] = useState<Record<string, boolean>>({});
  const [missingByProperty, setMissingByProperty] = useState<Record<string, string>>({});

  const computeMissing = useCallback((bundle: Awaited<ReturnType<typeof fetchPropertyWithRooms>>): string[] => {
    if (!bundle) return ["No se pudo leer la propiedad"];
    const m: string[] = [];
    const p = bundle.property;
    const isRoomPost = p.postMode === "room";
    if (!isRoomPost && (!p.title?.trim() || p.title.trim().toLowerCase() === "sin título")) {
      m.push("Nombre de propiedad");
    }
    if (!p.neighborhood?.trim()) m.push("Colonia");
    if (!p.city?.trim()) m.push("Ciudad");
    if (!p.contactWhatsApp?.trim() || p.contactWhatsApp.replace(/\D/g, "").length < 10) m.push("WhatsApp real");
    if (!isRoomPost && (!p.summary?.trim() || p.summary.trim().length < 20)) m.push("Descripción de la propiedad");
    if (!bundle.rooms?.length) m.push("Al menos 1 cuarto");
    for (const r of bundle.rooms ?? []) {
      if (!r.title?.trim()) m.push(`Título de cuarto (${r.id})`);
      if (!r.summary?.trim()) m.push(`Descripción de cuarto (${r.id})`);
      if (!Number.isFinite(r.rentMxn) || r.rentMxn <= 0) m.push(`Renta (${r.id})`);
    }
    return [...new Set(m)];
  }, []);

  const groups = useMemo(() => {
    if (!rows?.length) return [] as [string, PropertyListing[]][];
    const m = new Map<string, PropertyListing[]>();
    for (const l of rows) {
      const list = m.get(l.propertyId) ?? [];
      list.push(l);
      m.set(l.propertyId, list);
    }
    return [...m.entries()].sort((a, b) => {
      const ta = a[1][0]?.propertyTitle ?? a[0];
      const tb = b[1][0]?.propertyTitle ?? b[0];
      return ta.localeCompare(tb, "es");
    });
  }, [rows]);

  useEffect(() => {
    const st = location.state as { draftSaved?: boolean } | null;
    if (st?.draftSaved) {
      setFlash("Borrador guardado en el servidor. Puedes publicar la propiedad cuando estés listo.");
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const load = useCallback(async () => {
    if (!apiOn) return;
    setBusy(true);
    setErr(null);
    try {
      const data = await fetchMyListings();
      setRows(data);
      const propIds = [...new Set(data.map((l) => l.propertyId))];
      const draftPropIds = propIds.filter((pid) => {
        const any = data.find((l) => l.propertyId === pid);
        const ps = any?.propertyStatus ?? "published";
        return ps === "draft";
      });
      const nextMissing: Record<string, string> = {};
      for (const pid of draftPropIds) {
        const bundle = await fetchPropertyWithRooms(pid).catch(() => null);
        const missing = computeMissing(bundle);
        if (missing.length) nextMissing[pid] = missing.join(" · ");
      }
      setMissingByProperty(nextMissing);
    } catch {
      setErr("No se pudieron cargar tus anuncios.");
      setRows([]);
      setMissingByProperty({});
    } finally {
      setBusy(false);
    }
  }, [apiOn, computeMissing]);

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

  async function archive(id: string) {
    setActionId(id);
    setErr(null);
    try {
      await updateListingStatus(id, "archived");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo archivar.");
    } finally {
      setActionId(null);
    }
  }

  async function pauseProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "paused" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo pausar la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  async function republishProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "published" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo republicar la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  async function archiveProperty(propertyId: string) {
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "archived" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo archivar la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  async function publishDraftProperty(propertyId: string) {
    if (!legalPublishByProperty[propertyId]) {
      setErr("Marca la confirmación legal antes de publicar la propiedad.");
      return;
    }
    if (missingByProperty[propertyId]) {
      setErr(`Completa lo siguiente antes de publicar: ${missingByProperty[propertyId]}`);
      return;
    }
    setActionPropertyId(propertyId);
    setErr(null);
    try {
      await updateProperty(propertyId, { status: "published" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo publicar la propiedad.");
    } finally {
      setActionPropertyId(null);
    }
  }

  function rowBusy(l: PropertyListing): boolean {
    return actionId === l.id || actionPropertyId === l.propertyId;
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
            Aquí puedes ver tus borradores y tus anuncios activos. Un borrador puede crearse sin cuenta, pero
            para activarlo y publicarlo necesitas iniciar sesión.
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

      {flash ? (
        <p className="mt-4 rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-body">
          {flash}
        </p>
      ) : null}

      {err ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {busy && rows === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : rows?.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted shadow-sm">
            Aún no hay anuncios asociados a esta sesión.{" "}
            <Link to="/publicar" className="font-semibold text-primary underline-offset-2 hover:underline">
              Publicar
            </Link>
          </p>
        ) : (
          groups.map(([propertyId, list]) => {
            const head = list[0]!;
            const propSt = head.propertyStatus ?? "published";
            const propActing = actionPropertyId === propertyId;

            return (
              <section
                key={propertyId}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
              >
                <div className="flex flex-col gap-3 border-b border-border bg-surface-elevated px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {propertyStatusLabel(head.propertyStatus)}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-body">
                      {head.propertyTitle ?? head.title}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-muted">{propertyId}</p>
                    {propSt === "draft" && missingByProperty[propertyId] ? (
                      <p className="mt-2 text-xs text-amber-900">
                        Falta: <span className="font-medium">{missingByProperty[propertyId]}</span>
                      </p>
                    ) : null}
                    {head.propertyPostMode === "room" ? (
                      <p className="mt-2 text-xs text-muted">
                        Tipo: <span className="font-medium text-body">solo un cuarto</span> (puedes convertirlo a propiedad).
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {propSt === "draft" ? (
                      <>
                        <Link
                          to={`/publicar?edit=${encodeURIComponent(propertyId)}`}
                          className="rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-body transition hover:bg-surface-elevated"
                        >
                          Editar
                        </Link>
                        {head.propertyPostMode === "room" ? (
                          <Link
                            to={`/publicar?edit=${encodeURIComponent(propertyId)}&upgrade=1`}
                            className="rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-primary transition hover:brightness-95"
                          >
                            Convertir a propiedad
                          </Link>
                        ) : null}
                        <label className="flex max-w-full cursor-pointer items-center gap-2 text-xs text-body">
                          <input
                            type="checkbox"
                            checked={Boolean(legalPublishByProperty[propertyId])}
                            onChange={(e) =>
                              setLegalPublishByProperty((m) => ({
                                ...m,
                                [propertyId]: e.target.checked,
                              }))
                            }
                            className="size-4 shrink-0 rounded border-border text-primary"
                          />
                          <span>Confirmo datos verídicos y acepto publicar (v1)</span>
                        </label>
                        <button
                          type="button"
                          disabled={propActing}
                          onClick={() => void publishDraftProperty(propertyId)}
                          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-fg transition enabled:hover:brightness-110 disabled:opacity-50"
                        >
                          {propActing ? "…" : "Publicar propiedad"}
                        </button>
                      </>
                    ) : null}
                    {propSt === "published" ? (
                      <button
                        type="button"
                        disabled={propActing}
                        onClick={() => void pauseProperty(propertyId)}
                        className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50"
                      >
                        {propActing ? "…" : "Pausar propiedad"}
                      </button>
                    ) : null}
                    {propSt === "paused" ? (
                      <button
                        type="button"
                        disabled={propActing}
                        onClick={() => void republishProperty(propertyId)}
                        className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-body transition hover:bg-surface disabled:opacity-50"
                      >
                        {propActing ? "…" : "Republicar propiedad"}
                      </button>
                    ) : null}
                    {propSt === "published" || propSt === "paused" ? (
                      <button
                        type="button"
                        disabled={propActing}
                        onClick={() => void archiveProperty(propertyId)}
                        className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted transition hover:bg-surface disabled:opacity-50"
                      >
                        {propActing ? "…" : "Archivar propiedad"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-4 py-3">Cuarto / título</th>
                        <th className="px-4 py-3">Ciudad</th>
                        <th className="px-4 py-3">Estado cuarto</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-body">
                      {list.map((l) => {
                        const st = l.status ?? "published";
                        const acting = rowBusy(l);
                        return (
                          <tr key={l.id}>
                            <td className="px-4 py-3 font-medium">{l.title}</td>
                            <td className="px-4 py-3 text-muted">{l.city}</td>
                            <td className="px-4 py-3">{statusLabel(st)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Link
                                  to={`/anuncio/${l.id}`}
                                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-body hover:bg-surface-elevated"
                                >
                                  {st === "published" && propSt === "published"
                                    ? "Ver público"
                                    : "Vista previa"}
                                </Link>
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
                                {st === "published" || st === "paused" ? (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => void archive(l.id)}
                                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted hover:bg-surface-elevated disabled:opacity-50"
                                  >
                                    {acting ? "…" : "Archivar"}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </div>

      <p className="mt-8 text-xs text-muted">
        Cuartos:{" "}
        <code className="rounded bg-surface-elevated px-1">PATCH /api/listings/:id</code> con{" "}
        <code className="rounded bg-surface-elevated px-1">{"{ \"status\" }"}</code>. Propiedad:{" "}
        <code className="rounded bg-surface-elevated px-1">PATCH /api/properties/:id</code>.
      </p>
    </div>
  );
}
